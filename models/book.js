const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const bookSchema = new mongoose.Schema({
	author: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Author',
		required: true,
	},
	published: {
		type: Number,
	},
	title: {
		type: String,
		required: true,
		unique: true,
		minlength: 5,
	},
	genres: [
		{
			type: String,
		},
	],
});

bookSchema.plugin(uniqueValidator);

module.exports = mongoose.model('Book', bookSchema);
