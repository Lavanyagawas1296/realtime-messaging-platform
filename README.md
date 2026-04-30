# 💬 Arham Chat App

A simple real-time chat application built using **React, Capacitor, and Supabase** as part of the Arham Fintech Frontend Intern Assessment.

---

## 🚀 Features

* 🔐 User Authentication (Email & Password via Supabase)
* 💬 Real-time messaging (Supabase Realtime)
* 📋 Chat list showing conversations
* 📱 Mobile app using Capacitor (Android)
* 🔄 Live updates without refresh

---

## 🛠 Tech Stack

* React (Vite)
* Capacitor (Android app)
* Supabase (Auth + Database + Realtime)

---

## 🧱 Database Schema (Supabase)

### conversations

* id
* created_at

### conversation_participants

* conversation_id
* user_id

### messages

* id
* conversation_id
* sender_id
* content
* created_at

---

## ⚙️ Setup Instructions

### 1. Clone repo

```bash
git clone <your-repo-link>
cd frontend
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Setup environment variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

---

### 4. Run locally

```bash
npm run dev
```

---

## 📱 Build Android App (APK)

```bash
npm run build
npx cap sync
npx cap open android
```

Then in Android Studio:

* Build → Generate APK

---

## 📦 APK Download
https://drive.google.com/file/d/1J7ZjaVOqqg3Vhz4TIXlLLnrTyeK55wxp/view?usp=drive_link

---

## 🎥 Demo Video

https://drive.google.com/file/d/19oQKs-PHtGXZG8VTbHKI9p3xCKYYKNey/view?usp=sharing

---

## 📌 Notes

* Email confirmation disabled for easier testing
* Basic UI kept simple as per assignment requirement
* Focused on functionality and real-time behavior

---

## 👤 Author

Lavanya Gawas
Aspiring Backend Engineer | Java + DSA
