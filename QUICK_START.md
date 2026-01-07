# Quick Start Guide - DOCQ Mint MVP

## 🎯 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables

Create `.env.local`:
```bash
# Firebase (Get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# PostgreSQL (Get from Heroku or your provider)
DATABASE_URL=postgresql://user:password@host:5432/database

# AWS S3 (Get from AWS Console)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

### 3. Set Up Database
```bash
# Run schema on your PostgreSQL database
psql $DATABASE_URL < schema.sql
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` 🚀

---

## 📱 Testing the Application

### As a School Administrator

1. **Sign Up**
   - Go to `http://localhost:3000`
   - Click "Sign Up" or use Google Sign-in
   - Create account with email/password

2. **Create School**
   - After login, you'll be redirected to identity selection
   - If no schools exist, click "Create a School"
   - Fill in school details and submit

3. **Select Admin Role**
   - Choose "School Administrator"
   - Select your school from dropdown
   - Click "Continue as School Admin"

4. **Use Dashboard**
   - **Upload Documents**: Go to Documents tab → Upload Document
   - **Invite Students**: Go to Members tab → Invite Member
   - **Manage School**: Go to Settings tab to edit school info

### As a Student

1. **Get Invited**
   - School admin must first invite you with your email
   - (For testing: have admin create an invitation)

2. **Sign Up/Sign In**
   - Use the email you were invited with
   - Or create account with that email

3. **Select Student Role**
   - Choose "Student" 
   - Select your school
   - Click "Continue as Student"

4. **View Documents**
   - See all documents uploaded for you
   - Download documents as needed

---

## 🔧 Common Setup Issues

### Firebase Configuration
- Make sure all `NEXT_PUBLIC_` prefixed variables are set
- Get credentials from [Firebase Console](https://console.firebase.google.com/)
- Enable Email/Password and Google authentication in Firebase

### Database Connection
- Verify `DATABASE_URL` is correct
- Ensure database is accessible from your machine
- Check that all tables are created (run schema.sql)

### S3 Upload Issues
- Verify AWS credentials are correct
- Check bucket name matches
- Ensure bucket has proper CORS configuration (see `S3_CORS_CONFIG.json`)
- Verify IAM user has proper permissions (see `IAM_POLICY.json`)

---

## 🧪 Test Scenarios

### Scenario 1: School Admin Workflow
```
1. Sign up → 2. Create school → 3. Select admin role → 
4. Invite student → 5. Upload document for student
```

### Scenario 2: Student Workflow
```
1. Get invited by admin → 2. Sign up with invited email → 
3. Select student role → 4. View documents
```

### Scenario 3: Multiple Schools
```
1. Create multiple schools → 2. Switch between schools → 
3. Invite different members to different schools
```

---

## 📊 Database Tables

After running `schema.sql`, you should have:

- ✅ `docq_mint_wallets` - Wallet management (future NFT use)
- ✅ `docq_mint_schools` - School records
- ✅ `docq_mint_users` - User accounts
- ✅ `docq_mint_school_memberships` - User-School relationships
- ✅ `docq_mint_documents` - Document records
- ✅ `docq_mint_nfts` - NFT records (future use)
- ✅ `docq_mint_nft_mint_queue` - Mint queue (future use)
- ✅ `docq_mint_claims` - NFT claims (future use)

---

## 🚀 Next Steps

1. **Customize UI**: Update branding in `app/page.tsx`
2. **Add Features**: Extend based on `REQUIREMENT.md`
3. **Deploy**: Follow deployment guide in `README.md`
4. **Security**: Review security notes in `IMPLEMENTATION_GUIDE.md`

---

## 🆘 Need Help?

- Check `IMPLEMENTATION_GUIDE.md` for detailed docs
- Review `REQUIREMENT.md` for feature specifications
- Check API routes in `app/api/` for endpoint details
- Review component code in `components/` for UI logic

---

## ✅ Checklist

Before considering setup complete:

- [ ] Firebase Auth working (can sign up/sign in)
- [ ] Database connected (no connection errors)
- [ ] S3 upload working (can upload files)
- [ ] Can create school
- [ ] Can invite members
- [ ] Can upload documents
- [ ] Student can view documents

---

**Ready to build!** 🎉

