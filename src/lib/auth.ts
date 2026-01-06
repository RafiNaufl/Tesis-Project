import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "../generated/prisma";
import { compare } from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = credentials.identifier.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

        let user = null as any;

        if (isEmail) {
          user = await prisma.user.findFirst({
            where: { email: { equals: identifier, mode: "insensitive" } },
            include: { employee: true },
          });
        } else {
          const employee = await prisma.employee.findFirst({
            where: { contactNumber: identifier },
            select: { userId: true },
          });
          if (employee?.userId) {
            user = await prisma.user.findUnique({ 
              where: { id: employee.userId },
              include: { employee: true },
            });
          }
        }

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(credentials.password, user.hashedPassword);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.profileImageUrl || null,
          position: user.employee?.position || null,
          division: user.employee?.division || null,
          organization: user.employee?.organization || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        return {
          ...token,
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
          position: user.position,
          division: user.division,
          organization: user.organization,
        };
      }
      
      // Handle session update from client
      if (trigger === "update" && session) {
        return {
          ...token,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          id: token.id,
          role: token.role,
          position: token.position,
          division: token.division,
          organization: token.organization,
        };
      }
      
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          name: token.name,
          email: token.email,
          role: token.role,
          image: token.image,
          position: token.position,
          division: token.division,
          organization: token.organization,
        },
      };
    },
  },
}; 
