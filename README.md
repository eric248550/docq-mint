# DOCQ Mint - MVP

Academic document management and verification system for schools and students.

## 🚀 Features

- **Firebase Authentication** - Email/Password and Google Sign-in
- **School Management** - Create and manage schools with role-based access
- **Cardano Wallet Integration** - Automatic wallet creation for schools and users
- **Document Upload** - Secure AWS S3 storage with file hashing
- **Student Portal** - Students can view and download their documents
- **Member Management** - Invite students and manage school memberships

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database (Heroku or similar)
- Firebase project
- AWS S3 bucket
- Blockfrost API key (for Cardano blockchain access)

## 🛠️ Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo>
   cd docq-mint
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your credentials:
   - Firebase configuration (from Firebase Console)
   - `DATABASE_URL` - PostgreSQL connection string
   - AWS S3 credentials (region, access key, secret, bucket name)
   - Cardano configuration:
     - `CARDANO_NETWORK` - 'mainnet' or 'preprod'
     - `BLOCKFROST_API_KEY` - Get from https://blockfrost.io
     - `SEED_ENCRYPT_KEY` - 32-character encryption key for seed phrases

4. **Set up database**
   
   Run the schema on your PostgreSQL database:
   ```bash
   psql $DATABASE_URL < schema.sql
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

## 📖 User Guide

### For School Administrators

1. Sign up/Sign in with Firebase Auth
2. Select "School Administrator" identity
3. Create a school if none exists
4. From the dashboard:
   - Upload documents for students
   - Invite students and members
   - Manage school settings

### For Students

1. Sign up/Sign in (must be invited by school first)
2. Select "Student" identity
3. View and download your documents

## 🏗️ Project Structure

```
├── app/
│   ├── api/          # API routes
│   ├── dashboard/    # Dashboard page
│   ├── identity/     # Identity selection page
│   └── page.tsx      # Landing page
├── components/       # React components
├── hooks/           # Custom React hooks
├── lib/
│   ├── api/         # API client utilities
│   ├── auth/        # Firebase auth utilities
│   ├── db/          # Database utilities
│   ├── firebase/    # Firebase config
│   ├── s3/          # S3 utilities
│   └── wallet/      # Cardano wallet utilities
├── store/           # Zustand state management
└── schema.sql       # Database schema
```

## 🔒 Security Notes

⚠️ **This is an MVP with simplified security.** For production:

- Implement Firebase Admin SDK for server-side token verification
- Add comprehensive input validation and sanitization
- Implement rate limiting
- Add audit logging
- Configure proper CORS for S3
- Add server-side file validation

## 📚 Documentation

- [WALLET_SETUP.md](./WALLET_SETUP.md) - Cardano wallet integration guide
- [REQUIREMENT.md](./REQUIREMENT.md) - Product requirements
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [schema.sql](./schema.sql) - Database schema

## 🧪 Testing

```bash
npm test
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: PostgreSQL
- **Storage**: AWS S3
- **Blockchain**: Cardano (via Mesh SDK)
- **State Management**: Zustand
- **UI Components**: Shadcn/ui, Radix UI

## 📝 API Routes

### Authentication
- `GET /api/users/me` - Get current user
- `POST /api/users/identity` - Set identity context

### Schools
- `GET /api/schools` - List schools
- `POST /api/schools` - Create school
- `GET /api/schools/:id` - Get school
- `PATCH /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

### Members
- `GET /api/schools/:id/members` - List members
- `POST /api/schools/:id/members` - Invite member
- `DELETE /api/schools/:id/members/:memberId` - Remove member

### Documents
- `GET /api/schools/:id/documents` - List documents
- `POST /api/schools/:id/documents` - Create document
- `GET /api/documents/:id` - Get document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/students/documents` - Student's documents

### Wallets
- `GET /api/wallets/:ownerId` - Get wallet information

## 🚫 Out of Scope

The following features are planned for future releases:

- NFT minting UI
- Email delivery
- Advanced wallet management UI
- Document encryption
- Multi-factor authentication
- Advanced analytics

## 📄 License

Private project - All rights reserved

## 🤝 Support

For questions or issues, refer to the documentation files or contact the development team.
