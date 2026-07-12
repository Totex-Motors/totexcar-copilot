import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { BlogPost } from '../data/blogPosts';

export const CategoryBadge = ({ category }: { category: string }) => {
  let colorClass = "text-gray-400";
  
  switch (category.toUpperCase()) {
    case 'SAAS':
      colorClass = "text-teal-500";
      break;
    case 'FINANCE':
      colorClass = "text-[#FEBC2E]"; // Gold/Yellow
      break;
    case 'AI':
      colorClass = "text-cyan-500";
      break;
    case 'STARTUP':
      colorClass = "text-cyan-500";
      break;
    case 'FEATURED':
      colorClass = "text-teal-500";
      break;
  }

  return (
    <span className={cn("text-xs font-bold tracking-widest uppercase", colorClass)}>
      {category}
    </span>
  );
};

interface BlogCardProps {
  post: BlogPost;
  index?: number;
}

export const BlogCard = ({ post, index = 0 }: BlogCardProps) => (
  <Link to={`/blog/${post.id}`} className="block h-full">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group flex flex-col bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 h-full"
    >
      {/* Image */}
      <div className="relative h-56 w-full overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay z-10" />
        <img 
          src={post.image} 
          alt={post.title} 
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-4">
          <CategoryBadge category={post.category} />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {post.date}
          </span>
        </div>

        <h3 className="text-xl font-semibold text-white leading-snug group-hover:text-cyan-400 transition-colors mb-4">
          {post.title}
        </h3>
      </div>
    </motion.div>
  </Link>
);
