# ShortLinks - URL Shortener

A modern, fast, and privacy-focused URL shortening service built with Next.js 16, MongoDB, and NextAuth.

![ShortLinks Banner](public/vector.jpg)

## ✨ Features

- 🚀 **Lightning-fast URL shortening** - Generate short links in under 100ms
- 🔒 **Privacy-focused** - No tracking by default, no forced registration
- 🎨 **Modern UI** - Beautiful, responsive design with smooth animations
- 🔐 **Optional Authentication** - Sign in with Google, GitHub, Facebook, or LinkedIn
- 📱 **Fully Responsive** - Works seamlessly on desktop, tablet, and mobile
- 🎯 **Custom Aliases** - Create memorable short URLs
- 🌐 **Instant Redirects** - Fast 307 redirects to destination URLs

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Database:** MongoDB
- **Authentication:** NextAuth.js
- **Deployment Ready:** Vercel-optimized

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- MongoDB database (local or MongoDB Atlas)
- OAuth credentials for authentication providers (optional)

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/short_links.git
cd short_links
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:
```env
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_secret_key

# OAuth Providers (Optional - for login functionality)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret

LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# App URL
NEXT_PUBLIC_HOST=http://localhost:3000
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Set up MongoDB

Your MongoDB database should have:
- **Database name:** `bitlinks`
- **Collection name:** `url`

The collection will store documents with this structure:
```json
{
  "_id": "ObjectId",
  "url": "https://example.com/very-long-url",
  "shorturl": "abc123"
}
```

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure
```
short_links/
├── app/
│   ├── [shorturl]/          # Dynamic route for redirects
│   │   └── route.js
│   ├── api/
│   │   ├── auth/            # NextAuth configuration
│   │   │   └── [...nextauth]/
│   │   │       └── route.js
│   │   └── generate/        # URL generation API
│   │       └── route.js
│   ├── login/               # Login page
│   │   └── page.js
│   ├── shorten/             # URL shortening page
│   │   └── page.js
│   ├── layout.js            # Root layout
│   ├── page.js              # Homepage
│   └── globals.css          # Global styles
├── components/
│   ├── Navbar.js            # Navigation bar
│   ├── Footer.js            # Footer component
│   └── SessionWrapper.js    # NextAuth session wrapper
├── lib/
│   └── mongodb.js           # MongoDB connection
├── public/
│   └── vector.jpg           # Hero image
├── .env.local               # Environment variables (not in git)
├── .gitignore
├── package.json
└── README.md
```

## 🎯 Usage

### Basic URL Shortening (No Login Required)

1. Visit the homepage
2. Click "Try Now" or navigate to `/shorten`
3. Paste your long URL
4. Enter a custom short code (optional)
5. Click "Generate"
6. Copy your shortened URL!

### With User Account

1. Click "Login" and sign in with your preferred provider
2. Manage, track, and organize your links




## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Your Name**
- GitHub: [TanushHAlder04](https://github.com/TanushHAlder04)

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- MongoDB for the database solution
- NextAuth.js for authentication
- Tailwind CSS for styling utilities

## 📧 Support

For support, email : tanushhalder.2004@gmail.com or open an issue in the GitHub repository.

---

Made with ❤️ using Next.js