import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a test store
  const store = await prisma.store.upsert({
    where: { shopDomain: "test-store.myshopify.com" },
    update: {},
    create: {
      shopDomain: "test-store.myshopify.com",
      accessToken: "encrypted_test_token_placeholder",
      plan: "trial",
      jobsThisMonth: 2,
      monthResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    },
  });

  console.log(`Created store: ${store.shopDomain}`);

  // Create a succeeded job
  const succeededJob = await prisma.job.create({
    data: {
      storeId: store.id,
      type: "price_update",
      status: "succeeded",
      config: JSON.stringify({
        wizard: "price",
        filter: { by: "tag", tag: "sale" },
        operation: { type: "decrease_pct", pct: 10 },
        targets: { allVariants: true },
      }),
      summary: JSON.stringify({
        total: 150,
        succeeded: 148,
        failed: 2,
        errors: [
          { variantId: "variant_1", error: "Price would be negative" },
          { variantId: "variant_2", error: "Invalid variant" },
        ],
      }),
      startedAt: new Date(Date.now() - 60000),
      finishedAt: new Date(),
    },
  });

  console.log(`Created succeeded job: ${succeededJob.id}`);

  // Create a failed job
  const failedJob = await prisma.job.create({
    data: {
      storeId: store.id,
      type: "inventory_update",
      status: "failed",
      config: JSON.stringify({
        wizard: "inventory",
        locations: ["location_1"],
        filter: { by: "collection", collectionId: "collection_123" },
        operation: { type: "set_absolute", quantity: 0 },
      }),
      summary: JSON.stringify({
        total: 50,
        succeeded: 23,
        failed: 27,
        errors: [{ variantId: "variant_3", error: "API rate limit exceeded" }],
      }),
      startedAt: new Date(Date.now() - 120000),
      finishedAt: new Date(Date.now() - 60000),
    },
  });

  console.log(`Created failed job: ${failedJob.id}`);

  // Create some ChangeLog entries for the succeeded job
  await prisma.changeLog.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      jobId: succeededJob.id,
      shopifyProductId: `product_${i + 1}`,
      shopifyVariantId: `variant_${i + 1}`,
      field: "price",
      oldValue: `${(25 + i * 0.5).toFixed(2)}`,
      newValue: `${(22.5 + i * 0.45).toFixed(2)}`,
    })),
  });

  console.log(`Created 10 change log entries for job: ${succeededJob.id}`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });