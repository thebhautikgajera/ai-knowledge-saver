import { Queue, Worker } from 'bullmq';
import { Item } from '../models/Item.js';
import { scrapeOpenGraphMetadata } from './openGraphScraper.js';
import { scrapeWithHeadlessBrowser } from './headlessScraper.js';
import { mergeMetadata } from './metadataMerge.js';

const QUEUE_NAME = 'metadata-enrichment';
const REDIS_URL = process.env.REDIS_URL;

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

  await metadataQueue.add(
    'enrich',
    {
      itemId,
      url,
      extensionMetadata,
    },
    {
      jobId: `item:${itemId}`,
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
      const { itemId, url, extensionMetadata } = job.data || {};
      if (!itemId || !url) return;

      const ogMeta = await scrapeOpenGraphMetadata(url);
      const headlessMeta = !ogMeta ? await scrapeWithHeadlessBrowser(url) : null;

      const { final, metadataSource } = mergeMetadata(
        extensionMetadata,
        ogMeta,
        headlessMeta
      );

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
            metadataSource,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );
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

