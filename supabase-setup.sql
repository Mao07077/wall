-- SQL to create the necessary tables for your Wall app
-- Run this in your Supabase SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  information TEXT,
  networks TEXT,
  current_city TEXT,
  photo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
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

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public insert access on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public update access on profiles" ON profiles;

DROP POLICY IF EXISTS "Allow public read access on posts" ON posts;
DROP POLICY IF EXISTS "Allow public insert access on posts" ON posts;
DROP POLICY IF EXISTS "Allow public update access on posts" ON posts;

-- Create policies for public access (you may want to restrict this later)
CREATE POLICY "Allow public read access on profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on profiles" ON profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on posts" ON posts FOR UPDATE USING (true);

-- Create storage bucket for photos (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('wall-photos', 'wall-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for public access (drop existing policies first to avoid conflicts)
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;

CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'wall-photos');
CREATE POLICY "Allow public access" ON storage.objects FOR SELECT USING (bucket_id = 'wall-photos');

-- Insert the default profile with the UUID used in the app
INSERT INTO profiles (id, name, information, networks, current_city, photo_url) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'Greg Wientjes',
  'Software Developer',
  'LinkedIn, GitHub',
  'Palo Alto, CA',
  '/placeholder.jpg'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  information = EXCLUDED.information,
  networks = EXCLUDED.networks,
  current_city = EXCLUDED.current_city,
  photo_url = EXCLUDED.photo_url,
  updated_at = NOW();
