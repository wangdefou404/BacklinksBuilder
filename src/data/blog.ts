import { getCollection, getEntry } from 'astro:content';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: Date;
  author: string;
  tags: string[];
  content: string;
  image?: string;
  featured?: boolean;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const blogEntries = await getCollection('blog', ({ data }) => {
    return !data.draft;
  });

  const allPostsData = blogEntries.map(entry => {
    return {
      slug: entry.slug,
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.date,
      author: entry.data.author,
      tags: entry.data.tags,
      content: entry.body,
      image: entry.data.image,
      featured: entry.data.featured
    } as BlogPost;
  });

  return allPostsData.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const entry = await getEntry('blog', slug);
    if (!entry) return null;

    return {
      slug: entry.slug,
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.date,
      author: entry.data.author,
      tags: entry.data.tags,
      content: entry.body,
      image: entry.data.image,
      featured: entry.data.featured
    } as BlogPost;
  } catch (error) {
    return null;
  }
}