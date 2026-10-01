import { blogPosts } from "../data/blogPosts";
import { Item, PageHead, Photo, Closing, Label, Lines } from "../editorial";

// BLOG — lista editorial numerada; o primeiro post em destaque com foto.

export const Blogs = () => {
  const [first, ...rest] = blogPosts;
  return (
    <>
      <PageHead label="blog" lines={["Dicas pra", "cuidar do", <span className="acc" key="c">seu carro.</span>]}>
        Manutenção, documentos, vencimentos e dinheiro: o que a gente aprende no balcão, escrito pra quem dirige.
      </PageHead>

      {first && (
        <section style={{ paddingBottom: 40 }}>
          <div className="wrap two" style={{ alignItems: "end" }}>
            <Photo src={first.image} cap={first.date} ratio="16/10" n="01" to={`/blog/${first.id}`} />
            <div>
              <Label left>em destaque</Label>
              <h2 className="disp" style={{ fontSize: "clamp(32px,4.2vw,64px)", margin: "22px 0 20px" }}><Lines lines={[first.title]} /></h2>
              <p className="serif" style={{ fontSize: "clamp(19px,1.7vw,24px)", color: "var(--ink2)", margin: "0 0 28px", maxWidth: 520 }}>{first.excerpt}</p>
              <a href={`/blog/${first.id}`} className="pill ghost" style={{ padding: "13px 22px" }}>Ler artigo</a>
            </div>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap">
          <Label>todos os artigos</Label>
          <div style={{ height: 50 }} />
          {rest.map((p, i) => (
            <Item key={p.id} n={i + 2} title={p.title} star={i % 2 === 1} delay={(i % 3) * 0.07} to={`/blog/${p.id}`}
              meta={<><span className="mono">{p.category}</span><span className="mono">{p.date}</span></>}>
              {p.excerpt}
            </Item>
          ))}
          <div className="hair star" />
        </div>
      </section>

      <Closing lines={["Ler ajuda.", "Guardar resolve.", <span style={{ color: "var(--mute)" }} key="o">Comece pelo WhatsApp.</span>]} />
    </>
  );
};

export default Blogs;
