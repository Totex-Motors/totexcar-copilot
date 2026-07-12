import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTA } from '../components/CTA';
import { GradientBorder } from '../components/ui/GradientBorder';
import { BlogCard, CategoryBadge } from '../components/BlogCard';
import { blogPosts, BlogPost } from '../data/blogPosts';
import { RollingText } from '../components/ui/RollingText';

const FeaturedPost = ({ post }: { post: BlogPost }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    className="w-full bg-black border border-white/10 rounded-3xl overflow-hidden p-6 md:p-12 flex flex-col lg:flex-row gap-8 lg:gap-16 items-center relative group"
  >
    {/* Hover Glow Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

    {/* Content Side */}
    <div className="flex-1 flex flex-col items-start relative z-10">
      <div className="mb-4">
        <CategoryBadge category="FEATURED" />
      </div>
      
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
        {post.title}
      </h2>
      
      <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
        {post.excerpt}
      </p>

      <GradientBorder 
        gradient="from-teal-500 via-cyan-500 to-teal-600"
        containerClassName="rounded-full p-[1px]"
      >
        <Link to={`/blog/${post.id}`}>
          <button className="px-8 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-900 transition-colors flex items-center gap-2 group/btn">
            <RollingText text="Ler artigo" />
            <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </Link>
      </GradientBorder>
    </div>

    {/* Image Side */}
    <div className="flex-1 w-full lg:h-[400px] rounded-2xl overflow-hidden border border-white/10 relative z-10">
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent mix-blend-overlay z-10" />
      <img 
        src={post.image} 
        alt={post.title} 
        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 transform group-hover:scale-105"
      />
    </div>
  </motion.div>
);

export const Blogs = () => {
  const featuredPost = blogPosts[0];
  const otherPosts = blogPosts.slice(1);

  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] -left-[10%] w-[50vw] h-[50vw] bg-teal-600/10 blur-[150px] rounded-full opacity-60" />
        <div className="absolute top-[40%] -right-[10%] w-[50vw] h-[50vw] bg-cyan-600/10 blur-[150px] rounded-full opacity-60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6"
          >
            <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
              BLOG
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight mb-8"
          >
            Dicas pra cuidar <br />
            do seu carro
          </motion.h1>
        </div>

        {/* Featured Section */}
        <div className="mb-32">
          <FeaturedPost post={featuredPost} />
        </div>

        {/* All Blogs Grid */}
        <div className="mb-32">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-semibold text-white mb-12"
          >
            Todos os artigos
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherPosts.map((post, index) => (
              <BlogCard key={post.id} post={post} index={index} />
            ))}
          </div>
        </div>

      </div>

      <CTA />
    </div>
  );
};
