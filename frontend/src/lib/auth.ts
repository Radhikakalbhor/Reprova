import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getUsersCollection, UserDocument } from './mongodb';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('Please provide both username/email and password.');
        }

        const identifier = credentials.identifier.trim();
        const users = await getUsersCollection();

        // Search by lowercase email OR username
        const user = await users.findOne({
          $or: [
            { email: identifier.toLowerCase() },
            { username: identifier },
          ],
        });

        if (!user) {
          // Generic failure to prevent username harvesting
          throw new Error('Invalid email/username or password.');
        }

        if (!user.passwordHash) {
          throw new Error('This account uses Google sign-in. Please continue with Google.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email/username or password.');
        }

        // Update last login timestamp
        await users.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );

        return {
          id: user._id?.toString() || '',
          name: user.username,
          email: user.email,
          image: user.image,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) {
          return false;
        }

        const normalizedEmail = user.email.toLowerCase().trim();
        const users = await getUsersCollection();
        const existingUser = await users.findOne({ email: normalizedEmail });

        if (existingUser) {
          // Account already exists: link login by updating image & lastLoginAt
          await users.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                lastLoginAt: new Date(),
                ...(user.image && !existingUser.image ? { image: user.image } : {}),
              },
            }
          );
          user.id = existingUser._id?.toString() || '';
          user.name = existingUser.username;
          (user as { username?: string }).username = existingUser.username;
          return true;
        }

        // Generate clean unique username from email prefix
        const emailPrefix = normalizedEmail.split('@')[0];
        let baseUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18);
        if (baseUsername.length < 3) {
          baseUsername = `user_${baseUsername || 'auditor'}`.slice(0, 18);
        }

        let finalUsername = baseUsername;
        let counter = 1;
        while (await users.findOne({ username: finalUsername })) {
          const suffix = Math.floor(100 + Math.random() * 900).toString();
          finalUsername = `${baseUsername.slice(0, 18)}_${suffix}`.slice(0, 24);
          counter++;
          if (counter > 15) {
            finalUsername = `user_${Date.now().toString().slice(-8)}`;
            break;
          }
        }

        const now = new Date();
        const newUser: UserDocument = {
          username: finalUsername,
          email: normalizedEmail,
          passwordHash: null,
          image: user.image || null,
          provider: 'google',
          createdAt: now,
          lastLoginAt: now,
        };

        const result = await users.insertOne(newUser);
        user.id = result.insertedId.toString();
        user.name = finalUsername;
        (user as { username?: string }).username = finalUsername;
        return true;
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username || user.name || '';
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || '';
        session.user.username = (token.username as string) || session.user.name || '';
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
