import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, default: ''},
    email: {type: String, default: '', sparse: true},
    phone: {type: String, required: true, unique: true},
    password: {type: String, default: ''},
    role: {type: String, enum: ["owner", "user", "admin"], default: 'user' },
    image: {type: String, default: ''},
    isPhoneVerified: {type: Boolean, default: true},
},{timestamps: true})

const User = mongoose.model('User', userSchema)

export default User