import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { blogPosts } from '../data/blogPosts';
import { BlogCard } from '../components/BlogCard';
import { CTA } from '../components/CTA';

const ShareButton = ({ icon: Icon }: { icon: any }) => (
  <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
    <Icon size={16} />
  </a>
);

export const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Find post by ID
  const post = blogPosts.find(p => p.id === id);
  
  // Get related blogs (excluding current one, take 3)
  const relatedPosts = blogPosts
    .filter(p => p.id !== id)
    .sort(() => 0.5 - Math.random()) // Simple shuffle
    .slice(0, 3);

  useEffect(() => {
    // Scroll to top when post changes
    window.scrollTo(0, 0);
    
    // Redirect if post not found
    if (!post && id) {
      navigate('/blogs');
    }
  }, [id, post, navigate]);

  if (!post) return null;

  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-teal-600/10 blur-[150px] rounded-full opacity-50" />
        <div className="absolute top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-cyan-600/10 blur-[150px] rounded-full opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        
        {/* --- ARTICLE HEADER --- */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.15] mb-12"
          >
            {post.title}
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="w-full aspect-video rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl"
          >
            <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay z-10" />
            <img 
              src={post.image} 
              alt={post.title} 
              className="w-full h-full object-cover grayscale"
            />
          </motion.div>
        </div>

        {/* --- ARTICLE CONTENT --- */}
        <div className="max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="prose prose-invert prose-lg max-w-none"
          >
            {/* Render HTML Content */}
            <div dangerouslySetInnerHTML={{ __html: post.content || '' }} />
          </motion.div>

          {/* Share Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between"
          >
            <span className="text-white font-medium">Compartilhar</span>
            <div className="flex gap-3">
              <ShareButton icon={Facebook} />
              <ShareButton icon={Twitter} />
              <ShareButton icon={Linkedin} />
              <ShareButton icon={MessageCircle} />
            </div>
          </motion.div>
        </div>

        {/* --- RELATED BLOGS --- */}
        <div className="mb-32">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-12"
          >
            Artigos relacionados
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedPosts.map((p, index) => (
              <BlogCard key={p.id} post={p} index={index} />
            ))}
          </div>
        </div>

      </div>

      <CTA />
    </div>
  );
};
