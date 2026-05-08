import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    });
  }

  // Get body
  const body = await req.text();

  let evt: WebhookEvent;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error: Could not verify webhook:', err);
    return new Response('Error: Verification error', {
      status: 400,
    });
  }

  // Do something with payload
  const eventType = evt.type;
  console.log(`Received webhook with event type of ${eventType}`);

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name } = evt.data;
    const email = email_addresses[0]?.email_address;

    if (id && email) {
      const dbUser = await prisma.user.create({
        data: {
          clerkId: id,
          email,
        },
      });

      await prisma.workspace.create({
        data: {
          name: `${first_name || 'My'} Workspace`,
          userId: dbUser.id,
        },
      });
    }
  } else if (eventType === 'user.updated') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses[0]?.email_address;

    if (id && email) {
      await prisma.user.update({
        where: { clerkId: id },
        data: { email },
      });
    }
  } else if (eventType === 'user.deleted') {
    const { id } = evt.data;

    if (id) {
      try {
        await prisma.user.delete({
          where: { clerkId: id },
        });
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  }

  return new Response('Webhook received', { status: 200 });
}
