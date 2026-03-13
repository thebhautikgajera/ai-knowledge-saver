/**
 * Migration script to identify and resolve duplicate emails
 * 
 * Run this BEFORE creating unique indexes on email fields
 * 
 * Usage:
 *   node migrations/dedupe_emails.js
 * 
 * WARNING: Always backup your database before running migrations!
 */

import mongoose from 'mongoose';
import 'dotenv/config';
import { User } from '../src/models/User.js';

async function run() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI environment variable is required');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find duplicates grouped by tenantId + email
    console.log('🔍 Finding duplicate groups by (tenantId, email)...');
    const duplicates = await User.aggregate([
      {
        $group: {
          _id: { tenantId: '$tenantId', email: '$email' },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    console.log(`📊 Found ${duplicates.length} duplicate groups`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found. Safe to create unique indexes.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Find global email duplicates (across all tenants)
    console.log('🔍 Finding global email duplicates...');
    const globalDuplicates = await User.aggregate([
      {
        $group: {
          _id: '$email',
          ids: { $push: '$_id' },
          tenants: { $addToSet: '$tenantId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    console.log(`📊 Found ${globalDuplicates.length} emails used across multiple tenants`);

    // Display duplicates for review
    console.log('\n📋 Duplicate groups (tenantId + email):');
    for (const grp of duplicates) {
      console.log(`  - ${JSON.stringify(grp._id)}: ${grp.count} duplicates`);
      console.log(`    IDs: ${grp.ids.map(id => id.toString()).join(', ')}`);
    }

    if (globalDuplicates.length > 0) {
      console.log('\n📋 Global email duplicates (across tenants):');
      for (const grp of globalDuplicates) {
        console.log(`  - Email: ${grp._id}`);
        console.log(`    Count: ${grp.count}, Tenants: ${grp.tenants.join(', ')}`);
        console.log(`    IDs: ${grp.ids.map(id => id.toString()).join(', ')}`);
      }
    }

    console.log('\n⚠️  REVIEW THE DUPLICATES ABOVE BEFORE PROCEEDING');
    console.log('⚠️  This script will NOT automatically delete duplicates');
    console.log('⚠️  You must manually decide how to handle each duplicate group\n');

    // Option A: Keep earliest, delete rest
    // Uncomment the following block to enable automatic cleanup:
    /*
    console.log('🧹 Cleaning duplicates (keeping earliest created)...');
    for (const grp of duplicates) {
      const { ids } = grp;
      // Keep the earliest created (or you can choose latest)
      const keepId = ids[0];
      const removeIds = ids.slice(1);
      
      console.log(`  Cleaning ${removeIds.length} duplicates for ${JSON.stringify(grp._id)}`);
      
      // Delete duplicates
      await User.deleteMany({ _id: { $in: removeIds } });
      console.log(`  ✅ Deleted ${removeIds.length} duplicate(s)`);
    }
    */

    // Option B: Append suffix to email
    // Uncomment the following block to append suffix instead of deleting:
    /*
    console.log('🧹 Appending suffix to duplicate emails...');
    for (const grp of duplicates) {
      const { ids } = grp;
      const keepId = ids[0];
      const updateIds = ids.slice(1);
      
      console.log(`  Updating ${updateIds.length} duplicates for ${JSON.stringify(grp._id)}`);
      
      for (let i = 0; i < updateIds.length; i++) {
        const user = await User.findById(updateIds[i]);
        if (user) {
          const timestamp = Date.now();
          user.email = `${user.email}.dupe.${timestamp}`;
          await user.save();
          console.log(`  ✅ Updated email for ${updateIds[i]}`);
        }
      }
    }
    */

    // Option C: Move to legacy tenant
    // Uncomment the following block to move duplicates to a legacy tenant:
    /*
    const LEGACY_TENANT_ID = 'legacy-duplicates';
    console.log(`🧹 Moving duplicates to legacy tenant: ${LEGACY_TENANT_ID}...`);
    for (const grp of duplicates) {
      const { ids } = grp;
      const keepId = ids[0];
      const moveIds = ids.slice(1);
      
      console.log(`  Moving ${moveIds.length} duplicates for ${JSON.stringify(grp._id)}`);
      
      await User.updateMany(
        { _id: { $in: moveIds } },
        { $set: { tenantId: LEGACY_TENANT_ID } }
      );
      console.log(`  ✅ Moved ${moveIds.length} duplicate(s) to legacy tenant`);
    }
    */

    console.log('\n✅ Migration script completed');
    console.log('⚠️  Remember to review and handle duplicates before creating unique indexes');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

run();

