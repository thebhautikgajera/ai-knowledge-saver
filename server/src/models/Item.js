import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        url: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        domain: {
            type: String,
            default: '',
            trim: true,
            index: true,
        },
        favicon: {
            type: String,
            default: '',
            trim: true,
        },
        type: {
            type: String,
            enum: ['article', 'video', 'tweet'],
            default: 'article',
            index: true,
        },
        previewImage: {
            type: String,
            default: '',
            trim: true,
        },
        extraMetadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

itemSchema.index({ userId: 1, createdAt: -1 });
itemSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const Item = mongoose.model('Item', itemSchema);

