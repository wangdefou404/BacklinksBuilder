import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  image: string;
  content: string;
}

// 读取markdown文件并解析frontmatter
function loadBlogPost(filename: string): BlogPost {
  const filePath = join(process.cwd(), 'src/content/blog', filename);
  const fileContent = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  
  return {
    slug: data.slug,
    title: data.title,
    description: data.description,
    publishedAt: data.publishedAt,
    image: data.image,
    content: content
  };
}

// 获取所有博客文章
function loadAllBlogPosts(): BlogPost[] {
  const blogDir = join(process.cwd(), 'src/content/blog');
  const filenames = readdirSync(blogDir).filter(name => name.endsWith('.md'));
  
  return filenames
    .map(filename => loadBlogPost(filename))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export const blogPosts: BlogPost[] = loadAllBlogPosts();

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}