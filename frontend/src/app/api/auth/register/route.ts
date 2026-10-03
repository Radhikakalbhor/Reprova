import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUsersCollection, UserDocument } from '@/lib/mongodb';
import { registerSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const firstErrorMessage =
        fieldErrors.username?.[0] ||
        fieldErrors.email?.[0] ||
        fieldErrors.password?.[0] ||
        'Invalid registration inputs';

      return NextResponse.json(
        {
          error: firstErrorMessage,
          details: fieldErrors,
        },
        { status: 400 }
      );
    }

    const { username, email, password } = parseResult.data;
    const users = await getUsersCollection();

    // Check for duplicate email
    const existingEmail = await users.findOne({ email });
    if (existingEmail) {
      return NextResponse.json(
        {
          error: 'An account with this email already exists.',
          field: 'email',
        },
        { status: 409 }
      );
    }

    // Check for duplicate username
    const existingUsername = await users.findOne({ username });
    if (existingUsername) {
      return NextResponse.json(
        {
          error: 'This username is already taken.',
          field: 'username',
        },
        { status: 409 }
      );
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const newUser: UserDocument = {
      username,
      email,
      passwordHash,
      image: null,
      provider: 'credentials',
      createdAt: now,
      lastLoginAt: now,
    };

    const result = await users.insertOne(newUser);

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
        userId: result.insertedId.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration processing error:', error);
    return NextResponse.json(
      {
        error: 'Unable to process registration request. Please try again later.',
      },
      { status: 500 }
    );
  }
}
