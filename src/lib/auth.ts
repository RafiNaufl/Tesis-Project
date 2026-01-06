import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
        console.log("Authorize called with:", { ...credentials, password: "***" });
        
        const identifier = credentials?.identifier || (credentials as any)?.email;
        const password = credentials?.password;

        if (!identifier || !password) {
          console.log("Missing identifier or password");
          return null;
        }

        const trimmedIdentifier = identifier.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);

        let user = null as any;

        try {
          if (isEmail) {
            user = await prisma.user.findFirst({
              where: { email: { equals: trimmedIdentifier, mode: "insensitive" } },
              include: { employee: true },
            });
          } else {
            const employee = await prisma.employee.findFirst({
              where: { contactNumber: trimmedIdentifier },
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
            console.log("User not found for identifier:", trimmedIdentifier);
            return null;
          }

          const isPasswordValid = await compare(password, user.hashedPassword);
          if (!isPasswordValid) {
            console.log("Invalid password for user:", user.email);
            return null;
          }

          console.log("User authorized successfully:", user.email);

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
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
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
