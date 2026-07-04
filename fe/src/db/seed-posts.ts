import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './index';
import { users, posts, media } from './schema/index';

async function seed() {
  console.log('Seeding posts with media...');

  const loremIpsum = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio.",
    "Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
    "Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula.",
    "Donec lobortis risus a elit. Etiam aliquet faucibus lacus.",
    "Aliquam erat volutpat. Nam scelerisque, libero quis blandit tristique, elit orci faucibus nisl, id pellentesque risus nisi et neque."
  ];
  
  // Get at least one user
  let userList = await db.select().from(users).limit(1);
  let userId = userList[0]?.id;

  if (!userId) {
    console.log('No users found. Creating a dummy user...');
    const newUser = await db.insert(users).values({
      id: crypto.randomUUID(),
      username: 'seed_user',
      name: 'Seed User',
      email: `seed_${Date.now()}@example.com`,
    }).returning();
    userId = newUser[0].id;
  }

  const postsData = [];
  const mediaData = [];

  for (let i = 0; i < 1000; i++) {
    const postId = crypto.randomUUID();
    
    // Pick 1 to 3 random sentences for content
    const numSentences = Math.floor(Math.random() * 3) + 1;
    let content = "";
    for(let s = 0; s < numSentences; s++) {
      content += loremIpsum[Math.floor(Math.random() * loremIpsum.length)] + " ";
    }

    postsData.push({
      id: postId,
      authorId: userId,
      content: content.trim(),
      visibility: 'public',
    });

    // Add media to ~30% of posts
    if (Math.random() < 0.3) {
      const numImages = Math.floor(Math.random() * 4) + 1; // 1 to 4 images
      for (let j = 0; j < numImages; j++) {
        mediaData.push({
          id: crypto.randomUUID(),
          postId: postId,
          type: 'image',
          url: `https://picsum.photos/id/${Math.floor(Math.random() * 1000) + 1}/800/600`,
          width: 800,
          height: 600,
          sortOrder: j,
        });
      }
    }
  }

  // Insert in batches of 100 to avoid limits
  for (let i = 0; i < postsData.length; i += 100) {
    const postBatch = postsData.slice(i, i + 100);
    await db.insert(posts).values(postBatch);
    console.log(`Inserted post batch ${i / 100 + 1}`);
  }

  // Insert media in batches of 100
  for (let i = 0; i < mediaData.length; i += 100) {
    const mediaBatch = mediaData.slice(i, i + 100);
    await db.insert(media).values(mediaBatch);
    console.log(`Inserted media batch ${Math.floor(i / 100) + 1}`);
  }

  console.log(`Seeding complete! 1000 posts and ${mediaData.length} media items created.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});
