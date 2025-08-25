import { getCollection, getEntry } from 'astro:content';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: Date;
  author?: string;
  tags?: string[];
  image?: string;
  featured?: boolean;
  draft?: boolean;
  content: string;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog');
  
  return posts
    .filter(post => !post.data.draft)
    .sort((a, b) => {
      // 确保 publishedAt 是 Date 对象
      const aDate = a.data.publishedAt instanceof Date ? a.data.publishedAt : new Date(a.data.publishedAt);
      const bDate = b.data.publishedAt instanceof Date ? b.data.publishedAt : new Date(b.data.publishedAt);
      
      return bDate.getTime() - aDate.getTime();
    })
    .map(post => ({
      slug: post.slug,
      title: post.data.title,
      description: post.data.description,
      publishedAt: post.data.publishedAt,
      author: post.data.author,
      tags: post.data.tags,
      image: post.data.image,
      featured: post.data.featured,
      draft: post.data.draft,
      content: post.body
    }));
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const post = await getEntry('blog', slug);
    
    if (!post || post.data.draft) {
      return null;
    }
    
    return {
      slug: post.slug,
      title: post.data.title,
      description: post.data.description,
      publishedAt: post.data.publishedAt,
      author: post.data.author,
      tags: post.data.tags,
      image: post.data.image,
      featured: post.data.featured,
      draft: post.data.draft,
      content: post.body
    };
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}