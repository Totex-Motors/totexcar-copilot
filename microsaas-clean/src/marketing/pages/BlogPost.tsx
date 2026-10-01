import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { blogPosts } from "../data/blogPosts";
import { fade, Item, Photo, Closing, Label, Lines, WA } from "../editorial";

// POST — título display, meta em mono, foto, texto serifado. Compartilhar de verdade (WhatsApp e copiar link).

export const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = blogPosts.find((p) => p.id === id);
  const related = blogPosts.filter((p) => p.id !== id).slice(0, 3);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!post && id) navigate("/blogs");
  }, [id, post, navigate]);

  if (!post) return null;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const share = `https://wa.me/?text=${encodeURIComponent(`${post.title} — ${url}`)}`;

  return (
    <>
      <section className="top" style={{ paddingBottom: 60 }}>
        <div className="narrow">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link to="/blogs" className="mono" style={{ textDecoration: "none" }}>← blog</Link>
            <span className="mono">{post.category}</span>
            <span className="mono">{post.date}</span>
          </motion.div>
          <h1 className="disp" style={{ fontSize: "clamp(36px,6vw,92px)", margin: "26px 0 0", color: "#e9e9e9" }}>
            <Lines now delay={0.25} lines={[post.title]} />
          </h1>
          {post.excerpt && (
            <motion.p className="serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7 }} style={{ fontSize: "clamp(20px,2vw,28px)", color: "var(--ink2)", maxWidth: 640, margin: "36px 0 0" }}>
              {post.excerpt}
            </motion.p>
          )}
        </div>
      </section>

      <section style={{ paddingBottom: 80 }}>
        <div className="narrow"><Photo src={post.image} cap={post.category} ratio="16/9" /></div>
      </section>

      <section style={{ paddingBottom: 60 }}>
        <div className="narrow">
          <motion.div className="post" {...fade} dangerouslySetInnerHTML={{ __html: post.content || "" }} />
          <motion.div {...fade} className="hair" style={{ marginTop: 60, paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="mono">compartilhar</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={share} target="_blank" rel="noreferrer" className="pill ghost" style={{ padding: "12px 20px" }}>WhatsApp</a>
              <button className="pill ghost" style={{ padding: "12px 20px" }} onClick={() => navigator.clipboard?.writeText(url)}>Copiar link</button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="sec" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <Label>leia também</Label>
          <div style={{ height: 50 }} />
          {related.map((p, i) => (
            <Item key={p.id} n={i + 1} title={p.title} star={i % 2 === 1} delay={i * 0.07} to={`/blog/${p.id}`}
              meta={<><span className="mono">{p.category}</span><span className="mono">{p.date}</span></>}>
              {p.excerpt}
            </Item>
          ))}
          <div className="hair star" />
        </div>
      </section>

      <Closing lines={["Ler ajuda.", "Guardar resolve.", <span style={{ color: "var(--mute)" }} key="o">Comece pelo WhatsApp.</span>]} secondary={["Tirar dúvida", `https://wa.me/${WA}`]} />
    </>
  );
};

export default BlogPost;
