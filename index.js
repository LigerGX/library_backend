const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLError } = require('graphql');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const Author = require('./models/author');
const Book = require('./models/book');
const User = require('./models/user');

mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => {
		console.log('connected to MongoDB');
	})
	.catch((error) => {
		consol.log('error connecting to MongoDB', error.message);
	});

const typeDefs = `
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    id: ID!
    bookCount: Int
  }

	type User {
		username: String!
		favoriteGenre: String!
		password: String!
		id: ID!
	}

	type Token {
		value: String!
	}

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
		allUsers: [User!]!
		me: User
  }

	type Mutation {
		addBook(
			title: String!
			author: String!
			published: Int!
			genres: [String!]!
		): Book
		editAuthor(
			name: String!
			setBornTo: Int!
		): Author
		addUser(
			username: String!
			password: String!
			favoriteGenre: String!
		): User
		login(
			username: String!
			password: String!
		): Token
	}
`;

const resolvers = {
	Query: {
		bookCount: async () => Book.countDocuments(),
		authorCount: async () => Author.countDocuments(),
		allBooks: async (root, args) => {
			let query = {};
			if (args.author) {
				// possibly (100%) a stupid way of doing it, but oh well
				const author = await Author.findOne({ name: args.author });
				query.author = author.id;
			}
			if (args.genre) {
				query.genres = args.genre;
			}

			console.log(query);

			return Book.find(query).populate('author');
		},
		allAuthors: async () => Author.find({}),
		allUsers: async () => User.find({}),
		me: (root, args, context) => context.currentUser,
	},
	Mutation: {
		addBook: async (root, args, context) => {
			if (!context.currentUser) {
				throw new GraphQLError('User not logged in');
			}

			let author = await Author.findOne({ name: args.author });
			if (!author) {
				author = new Author({ name: args.author });
				try {
					await author.save();
				} catch (error) {
					throw new GraphQLError('Saving author failed', {
						extensions: {
							code: 'BAD_USER_INPUT',
							invalidArgs: args.author,
							error,
						},
					});
				}
			}

			const book = new Book({ ...args, author: author._id });
			try {
				await book.save();
				return book.populate('author');
			} catch (error) {
				throw new GraphQLError('Saving book failed', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args.book,
						error,
					},
				});
			}
		},
		editAuthor: async (root, args, context) => {
			if (!context.currentUser) {
				throw new GraphQLError('User not logged in');
			}

			try {
				return Author.findOneAndUpdate(
					{ name: args.name },
					{ born: args.setBornTo },
					{
						new: true,
					}
				);
			} catch (error) {
				throw new GraphQLError('Updating born value failed', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args.name,
						error,
					},
				});
			}
		},
		addUser: async (root, args) => {
			const hashedPassword = await bcrypt.hash(args.password, 10);

			const user = new User({
				username: args.username,
				favoriteGenre: args.favoriteGenre,
				password: hashedPassword,
			});

			try {
				return user.save();
			} catch (error) {
				throw new GraphQLError('User was not saved', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args,
						error,
					},
				});
			}
		},
		login: async (root, args) => {
			const user = await User.findOne({ username: args.username });

			if (!bcrypt.compare(args.password, user.password)) {
				throw new GraphQLError('Invalid password', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args.username,
						error,
					},
				});
			}

			const userForToken = {
				username: user.username,
				id: user._id,
			};

			return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
		},
	},
	Author: {
		bookCount: async (root) => Book.countDocuments({ author: root.id }),
	},
};

const server = new ApolloServer({
	typeDefs,
	resolvers,
});

startStandaloneServer(server, {
	listen: { port: 4000 },
	context: async ({ req, res }) => {
		const auth = req ? req.headers.authorization : null;
		if (auth && auth.startsWith('Bearer ')) {
			const decodedToken = jwt.verify(
				auth.substring(7),
				process.env.JWT_SECRET
			);
			const currentUser = await User.findById(decodedToken.id);
			return { currentUser };
		}
	},
}).then(({ url }) => {
	console.log(`Server ready at ${url}`);
});
