# DocQ Mint

A Next.js application built with TypeScript, Tailwind CSS, Shadcn/ui, Firebase Auth, and Zustand.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety with strict mode enabled
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Accessible component library built on Radix UI
- **Lucide React** - Icon library
- **Firebase Auth** - User authentication
- **Zustand** - State management
- **Jest** - Testing framework

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/              # Next.js App Router pages
├── components/       # React components
│   └── ui/          # Shadcn/ui components
├── lib/             # Utility functions and configurations
├── store/           # Zustand stores
└── .cursor/         # Cursor IDE rules
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run Jest tests in watch mode

## Features

- ✅ Next.js App Router
- ✅ TypeScript with strict mode
- ✅ Tailwind CSS configuration
- ✅ Shadcn/ui components
- ✅ Firebase Auth setup
- ✅ Zustand state management
- ✅ Jest testing configuration
- ✅ Error boundaries
- ✅ Responsive design

