import { Queue, Worker } from 'bullmq';
import { Item } from '../models/Item.js';
import { scrapeOpenGraphMetadata } from './openGraphScraper.js';
import { scrapeWithHeadlessBrowser } from './headlessScraper.js';
import { mergeMetadata } from './metadataMerge.js';
import { detectPlatform } from './platformDetection.js';

const QUEUE_NAME = 'metadata-enrichment';
const REDIS_URL = process.env.REDIS_URL;

/**
 * Check if platform requires full metadata extraction
 * Only Reddit, YouTube, Pinterest, and Twitter need full metadata
 */
const isSpecialPlatform = (platform) => {
  return ['reddit', 'youtube', 'pinterest', 'twitter'].includes(platform);
};

// Build BullMQ connection config if Redis is configured. If not, we run in
// "no-op" mode where enrichment jobs are simply skipped instead of crashing
// the whole app. This gives a permanent, graceful degradation when Redis
// isn't available (e.g. local dev without Redis).
const getConnection = () => {
  if (!REDIS_URL) {
    return null;
  }
  return { url: REDIS_URL };
};

const connection = getConnection();

export const metadataQueue =
  connection &&
  new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

export const enqueueMetadataEnrichment = async (
  itemId,
  url,
  extensionMetadata
) => {
  if (!itemId || !url) return;
  if (!metadataQueue) {
    // Redis / BullMQ disabled – skip enrichment but don't break the request.
    console.warn(
      '[MetadataQueue] REDIS_URL not set, skipping metadata enrichment job.'
    );
    return;
  }

  // Skip metadata enrichment for non-special platforms (only title needed)
  const platform = extensionMetadata?.platform || detectPlatform(url);
  if (!isSpecialPlatform(platform)) {
    console.log(`[MetadataQueue] Skipping enrichment for non-special platform: ${platform}`);
    return;
  }

  await metadataQueue.add(
    'enrich',
    {
      itemId,
      url,
      extensionMetadata,
    },
    {
      jobId: `item_${itemId}`,
    }
  );
};

export const startMetadataWorker = () => {
  if (!connection) {
    console.warn(
      '[MetadataQueue] REDIS_URL not set, metadata worker will not start.'
    );
    return null;
  }

  // Worker should be started from a dedicated worker process in production.
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      try {
        const { itemId, url, extensionMetadata } = job.data || {};
        if (!itemId || !url) {
          console.warn(`[MetadataQueue] Missing itemId or url for job ${job.id}`);
          return;
        }

        // Skip metadata enrichment for non-special platforms (only title needed)
        const platform = extensionMetadata?.platform || detectPlatform(url);
        if (!isSpecialPlatform(platform)) {
          console.log(`[MetadataQueue] Skipping enrichment for non-special platform: ${platform}`);
          return;
        }

        // Step 1: Try OpenGraph scraping (fastest)
        let ogMeta = null;
        try {
          ogMeta = await scrapeOpenGraphMetadata(url);
        } catch (err) {
          console.warn(`[MetadataQueue] OpenGraph scrape failed for ${url}:`, err.message);
        }

        // Step 2: Try headless browser if OpenGraph didn't provide enough data
        let headlessMeta = null;
        if (!ogMeta || (!ogMeta.title && !ogMeta.description)) {
          try {
            headlessMeta = await scrapeWithHeadlessBrowser(url);
          } catch (err) {
            console.warn(`[MetadataQueue] Headless scrape failed for ${url}:`, err.message);
          }
        }

        // Step 3: Merge metadata
        const { final, metadataSource } = mergeMetadata(
          extensionMetadata || {},
          ogMeta,
          headlessMeta
        );

        // Step 4: Update item in database
        try {
          await Item.findByIdAndUpdate(
            itemId,
            {
              $set: {
                title: final.title,
                description: final.description,
                content: final.content,
                image: final.image,
                favicon: final.favicon,
                author: final.author,
                authorImage: final.authorImage,
                platform: final.platform,
                type: final.type || undefined,
                metadataSource,
                updatedAt: new Date(),
              },
            },
            { new: true }
          );
        } catch (dbErr) {
          console.error(`[MetadataQueue] Database update failed for item ${itemId}:`, dbErr.message);
          throw dbErr; // Re-throw to trigger job retry
        }
      } catch (err) {
        console.error(`[MetadataQueue] Job processing error for ${job.id}:`, err.message);
        throw err; // Re-throw to trigger retry mechanism
      }
    },
    {
      connection: getConnection(),
    }
  );

  worker.on('completed', (job) => {
    console.log(`[MetadataQueue] Job completed for`, job.id);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[MetadataQueue] Job failed for ${job?.id}:`,
      err?.message || err
    );
  });

  return worker;
};

