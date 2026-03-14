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
        content: {
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
        image: {
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
        platform: {
            type: String,
            default: 'website',
            trim: true,
            index: true,
        },
        extraMetadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        author: {
            type: String,
            default: '',
            trim: true,
        },
        authorImage: {
            type: String,
            default: '',
            trim: true,
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
        updatedAt: {
            type: Date,
            default: Date.now,
        },
        metadataSource: {
            type: String,
            default: 'extension_dom',
            trim: true,
        },
    },
    {
        timestamps: false,
    }
);

itemSchema.index({ userId: 1, createdAt: -1 });
itemSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const Item = mongoose.model('Item', itemSchema);

