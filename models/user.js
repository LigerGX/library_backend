const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		minLength: 4,
		required: true,
	},
	password: {
		type: String,
		required: true,
		minLength: 5,
	},
	favoriteGenre: {
		type: String,
		required: true,
	},
});

userSchema.set('toJSON', {
	transform: (doc, ret) => {
		delete ret.password;
		return ret;
	},
});

module.exports = mongoose.model('User', userSchema);
