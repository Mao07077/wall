-- Migration script to fix existing tables if they have TEXT IDs instead of UUID
-- Run this in your Supabase SQL Editor if your tables already exist

-- Drop existing tables if they have wrong data types
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS profiles;

-- Create profiles table with correct UUID type
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  information TEXT,
  networks TEXT,
  current_city TEXT,
  photo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table with correct UUID type
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL,
  message TEXT NOT NULL,
  photo_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (author_id) REFERENCES profiles(id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access on profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on profiles" ON profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on posts" ON posts FOR UPDATE USING (true);

-- Insert the default profile with the fixed UUID
INSERT INTO profiles (id, name, information, networks, current_city, photo_url) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Greg Wientjes',
  '',
  '',
  '',
  '/placeholder.jpg'
) ON CONFLICT (id) DO NOTHING;
