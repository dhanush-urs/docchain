# DocChain

An immutable, blockchain-backed provenance ledger for your documents. Every upload, version, review, and verification is cryptographically recorded and independently verifiable.

## Features

- **Immutable Provenance Ledger**: Automatically records a cryptographic hash of every document action.
- **Secure Document Sharing**: Generate secure, role-based guest links with expiration dates.
- **Version Control**: Built-in document versioning that maintains the provenance history across all updates.
- **End-to-End Security**: Strict Row Level Security (RLS) enforcement integrated with robust Next.js API routing.
- **Rich Dashboard**: Monitor all activity, block generation, and document verification via an elegant, responsive UI built with Tailwind CSS and Shadcn.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Shadcn UI
- **Backend / Database**: Supabase (PostgreSQL), Supabase Storage
- **Authentication**: Supabase Auth (JWT)
- **Deployment**: Render / Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dhanush-urs/docchain.git
   cd docchain
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   *(Note: Remove any sensitive keys from tracking before pushing to remote).*

4. **Initialize Database Schema:**
   Run the SQL scripts provided in `schema.sql` inside your Supabase SQL Editor to set up the tables, functions, and initial Row Level Security (RLS) policies.

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## Security Considerations

- **Service Role Key**: The `SUPABASE_SERVICE_ROLE_KEY` is highly sensitive and is strictly used in secure server-side API routes to bypass RLS recursion bugs securely. Do NOT expose this key to the client.
- **CSRF Protection**: When deploying to production, ensure `NEXT_PUBLIC_APP_URL` is configured to your exact domain to securely enforce Next.js server action origin validation.

## License

MIT License
