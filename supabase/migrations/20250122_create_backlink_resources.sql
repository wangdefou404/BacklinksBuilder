-- Create backlink_resources table for comprehensive external link management
CREATE TABLE IF NOT EXISTS public.backlink_resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website_link TEXT NOT NULL,
    submit_url TEXT,
    dr INTEGER DEFAULT 0,
    traffic INTEGER DEFAULT 0,
    payment_type VARCHAR(50) DEFAULT 'free',
    follow_type VARCHAR(50) DEFAULT 'dofollow',
    platform_type VARCHAR(100),
    access_type VARCHAR(50) DEFAULT 'public',
    anchor_text TEXT,
    target_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_backlink_resources_user_id ON public.backlink_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_backlink_resources_status ON public.backlink_resources(status);
CREATE INDEX IF NOT EXISTS idx_backlink_resources_payment_type ON public.backlink_resources(payment_type);
CREATE INDEX IF NOT EXISTS idx_backlink_resources_follow_type ON public.backlink_resources(follow_type);
CREATE INDEX IF NOT EXISTS idx_backlink_resources_platform_type ON public.backlink_resources(platform_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.backlink_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own backlink resources" ON public.backlink_resources
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backlink resources" ON public.backlink_resources
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backlink resources" ON public.backlink_resources
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backlink resources" ON public.backlink_resources
    FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_backlink_resources_updated_at
    BEFORE UPDATE ON public.backlink_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON public.backlink_resources TO authenticated;
GRANT SELECT ON public.backlink_resources TO anon;