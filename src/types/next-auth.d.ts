import { Role } from "../generated/prisma/enums";

declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    image?: string | null;
    position?: string | null;
    division?: string | null;
    organization?: string | null;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    image?: string | null;
    position?: string | null;
    division?: string | null;
    organization?: string | null;
  }
}
