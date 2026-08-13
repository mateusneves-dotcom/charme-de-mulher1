import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

/* ---------- categorias (chave sem acento / rótulo com acento) ---------- */
const CATEGORY_META = {
  pulseiras: { label: 'Pulseiras', icon: (p) => (
    <svg viewBox="0 0 64 64" {...p}>
      <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="11" r="2.6" fill="currentColor" />
      <circle cx="53" cy="32" r="2.6" fill="currentColor" />
      <circle cx="32" cy="53" r="2.6" fill="currentColor" />
      <circle cx="11" cy="32" r="2.6" fill="currentColor" />
    </svg>
  ) },
  colares: { label: 'Colares', icon: (p) => (
    <svg viewBox="0 0 64 64" {...p}>
      <path d="M8 13 Q32 48 56 13" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="45" r="4.5" fill="currentColor" />
    </svg>
  ) },
  brincos: { label: 'Brincos', icon: (p) => (
    <svg viewBox="0 0 64 64" {...p}>
      <circle cx="32" cy="15" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M32 20.5 L32 38" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="44" r="4.5" fill="currentColor" />
    </svg>
  ) },
  aneis: { label: 'Anéis', icon: (p) => (
    <svg viewBox="0 0 64 64" {...p}>
      <circle cx="32" cy="39" r="15" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M23 25 L32 9 L41 25 Z" fill="currentColor" />
    </svg>
  ) },
};
const CAT_KEYS = Object.keys(CATEGORY_META);

const DEFAULT_CONFIG = {
  adminPassword: 'charme2026',
  whatsappNumber: '',
  pixKey: '',
  cardPaymentLink: '',
  sobreTexto: 'Criada por Laiana e Taiana, a Charme de Mulher nasceu para oferecer semijoias delicadas que valorizam o brilho do dia a dia. Cada peça é escolhida com carinho para durar e combinar com você.',
};

const fmt = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => Math.random().toString(36).slice(2, 10);
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const DELIVERY_FEE = 10;

const rowToConfig = (row) => ({
  adminPassword: row.admin_password || DEFAULT_CONFIG.adminPassword,
  whatsappNumber: row.whatsapp_number || '',
  pixKey: row.pix_key || '',
  cardPaymentLink: row.card_payment_link || '',
  sobreTexto: row.sobre_texto || DEFAULT_CONFIG.sobreTexto,
});
const configToRow = (cfg) => ({
  admin_password: cfg.adminPassword,
  whatsapp_number: cfg.whatsappNumber,
  pix_key: cfg.pixKey,
  card_payment_link: cfg.cardPaymentLink,
  sobre_texto: cfg.sobreTexto,
});

function resizeImage(file, maxDim = 640, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  const [category, setCategory] = useState('todas');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);

  const [page, setPage] = useState('shop');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminTab, setAdminTab] = useState('pedidos');
  const [editingProduct, setEditingProduct] = useState(null);

  /* --------- carregar dados do Supabase --------- */
  useEffect(() => {
    (async () => {
      try {
        const [prodRes, orderRes, configRes] = await Promise.all([
          supabase.from('produtos').select('*').order('name'),
          supabase.from('pedidos').select('*').order('date', { ascending: false }),
          supabase.from('config').select('*').eq('id', 1).maybeSingle(),
        ]);
        if (prodRes.error) throw prodRes.error;
        if (orderRes.error) throw orderRes.error;
        if (configRes.error) throw configRes.error;
        setProducts(prodRes.data || []);
        setOrders(orderRes.data || []);
        setConfig(configRes.data ? rowToConfig(configRes.data) : DEFAULT_CONFIG);
      } catch (e) {
        console.error(e);
        setStorageError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --------- funções de leitura/escrita --------- */
  const saveProduct = async (form) => {
    const isNew = !form.id;
    const clean = { ...form, id: isNew ? uid() : form.id, price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0 };
    try {
      const { error } = await supabase.from('produtos').upsert(clean);
      if (error) throw error;
      setProducts((prev) => isNew ? [...prev, clean] : prev.map((p) => p.id === clean.id ? clean : p));
      setEditingProduct(null);
    } catch (e) { console.error(e); setStorageError(true); }
  };

  const deleteProduct = async (id) => {
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { console.error(e); setStorageError(true); }
  };

  const adjustStock = async (id, delta) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    const newStock = Math.max(0, target.stock + delta);
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock: newStock } : p));
    try {
      const { error } = await supabase.from('produtos').update({ stock: newStock }).eq('id', id);
      if (error) throw error;
    } catch (e) { console.error(e); setStorageError(true); }
  };

  const updateOrderStatus = async (id, status) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    try {
      const { error } = await supabase.from('pedidos').update({ status }).eq('id', id);
      if (error) throw error;
    } catch (e) { console.error(e); setStorageError(true); }
  };

  const saveConfig = async (next) => {
    try {
      const { error } = await supabase.from('config').update(configToRow(next)).eq('id', 1);
      if (error) throw error;
      setConfig(next);
      return true;
    } catch (e) { console.error(e); setStorageError(true); return false; }
  };

  /* --------- carrinho --------- */
  const addToCart = (product, qty = 1) => {
    setCart((c) => {
      const found = c.find((i) => i.id === product.id);
      if (found) return c.map((i) => i.id === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i);
      return [...c, { id: product.id, name: product.name, price: product.price, qty: Math.min(qty, product.stock) }];
    });
    setCartOpen(true);
  };
  const updateQty = (id, qty) => setCart((c) => c.map((i) => i.id === id ? { ...i, qty: Math.max(1, qty) } : i).filter((i) => i.qty > 0));
  const removeFromCart = (id) => setCart((c) => c.filter((i) => i.id !== id));
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const finalizeOrder = async (form) => {
    const total = cartTotal + (form.deliveryFee || 0);
    const order = { id: uid().toUpperCase(), items: cart, total, customer: form, status: 'Novo', date: new Date().toISOString() };
    try {
      const { error } = await supabase.from('pedidos').insert(order);
      if (error) throw error;
      setOrders((prev) => [order, ...prev]);
      const updates = cart.map((i) => {
        const p = products.find((pp) => pp.id === i.id);
        if (!p) return Promise.resolve();
        const newStock = Math.max(0, p.stock - i.qty);
        return supabase.from('produtos').update({ stock: newStock }).eq('id', i.id);
      });
      await Promise.all(updates);
      setProducts((prev) => prev.map((p) => {
        const inCart = cart.find((i) => i.id === p.id);
        return inCart ? { ...p, stock: Math.max(0, p.stock - inCart.qty) } : p;
      }));
    } catch (e) {
      console.error(e); setStorageError(true);
    }
    setCart([]); setCheckoutOpen(false); setCartOpen(false); setConfirmedOrder(order);
  };

  const visibleProducts = products.filter((p) => category === 'todas' || p.category === category);

  if (loading) {
    return <div style={{ background: '#15120F', minHeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A567', fontFamily: 'Jost, sans-serif' }}>Carregando…</div>;
  }

  return (
    <div className="cdm-root">
      <Style />
      {page === 'shop' && (
        <Shop
          products={visibleProducts} category={category} setCategory={setCategory}
          addToCart={addToCart} cart={cart} cartOpen={cartOpen} setCartOpen={setCartOpen}
          updateQty={updateQty} removeFromCart={removeFromCart} cartTotal={cartTotal} cartCount={cartCount}
          detailProduct={detailProduct} setDetailProduct={setDetailProduct}
          checkoutOpen={checkoutOpen} setCheckoutOpen={setCheckoutOpen} finalizeOrder={finalizeOrder}
          confirmedOrder={confirmedOrder} setConfirmedOrder={setConfirmedOrder}
          myOrdersOpen={myOrdersOpen} setMyOrdersOpen={setMyOrdersOpen} orders={orders}
          goAdmin={() => setPage('admin-login')} storageError={storageError} config={config}
        />
      )}
      {page === 'admin-login' && (
        <AdminLogin loginPass={loginPass} setLoginPass={setLoginPass} loginError={loginError}
          onBack={() => setPage('shop')}
          onSubmit={() => {
            if (loginPass === config.adminPassword) { setPage('admin'); setLoginError(''); setLoginPass(''); }
            else setLoginError('Senha incorreta.');
          }}
        />
      )}
      {page === 'admin' && (
        <Admin products={products} orders={orders} config={config} adminTab={adminTab} setAdminTab={setAdminTab}
          saveProduct={saveProduct} deleteProduct={deleteProduct} adjustStock={adjustStock}
          updateOrderStatus={updateOrderStatus} saveConfig={saveConfig}
          editingProduct={editingProduct} setEditingProduct={setEditingProduct} onExit={() => setPage('shop')}
        />
      )}
    </div>
  );
}

/* ==================================================================== LOJA */
function Shop({ products, category, setCategory, addToCart, cart, cartOpen, setCartOpen,
  updateQty, removeFromCart, cartTotal, cartCount, detailProduct, setDetailProduct,
  checkoutOpen, setCheckoutOpen, finalizeOrder, confirmedOrder, setConfirmedOrder,
  myOrdersOpen, setMyOrdersOpen, orders, goAdmin, storageError, config }) {

  const heroRef = useRef(null);

  return (
    <div className="shop">
      {storageError && <div className="banner-warn">Não foi possível conectar ao banco de dados agora — suas alterações podem não salvar.</div>}

      <header className="header">
        <div className="brand">
          <div className="logo-ring"><span>CM</span></div>
          <div className="brand-text">
            <div className="brand-name">Charme de Mulher</div>
            <div className="brand-tag">semijoias</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="text-link" onClick={() => setMyOrdersOpen(true)}>Meus pedidos</button>
          <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Abrir carrinho">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20.4 8H6" /><circle cx="9" cy="20" r="1.3" fill="currentColor" /><circle cx="17" cy="20" r="1.3" fill="currentColor" /></svg>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </header>

      <section className="hero" ref={heroRef}>
        <div className="hero-ring" />
        <div className="hero-ring hero-ring-2" />
        <p className="hero-eyebrow">Coleção atual</p>
        <h1 className="hero-title">Semijoias que<br />transformam<br />qualquer look</h1>
        <p className="hero-sub">Peças folheadas a ouro, pensadas para durar e brilhar no seu dia a dia.</p>
        <a href="#colecao" className="hero-cta">Ver coleção</a>
      </section>

      <section className="about">
        <p>{config.sobreTexto}</p>
      </section>

      <nav className="filters" id="colecao">
        {[{ key: 'todas', label: 'Todas' }, ...CAT_KEYS.map((k) => ({ key: k, label: CATEGORY_META[k].label }))].map((c) => (
          <button key={c.key} className={"filter-chip" + (category === c.key ? ' active' : '')} onClick={() => setCategory(c.key)}>{c.label}</button>
        ))}
      </nav>

      <section className="grid">
        {products.map((p) => {
          const meta = CATEGORY_META[p.category] || CATEGORY_META.pulseiras;
          return (
            <article key={p.id} className="card" onClick={() => setDetailProduct(p)}>
              <div className="card-visual">
                {p.image ? <img src={p.image} alt={p.name} /> : meta.icon({ className: 'card-icon' })}
                {p.stock === 0 && <span className="badge-out">Esgotado</span>}
              </div>
              <div className="card-body">
                <span className="card-cat">{meta.label}</span>
                <h3 className="card-name">{p.name}</h3>
                <div className="card-row">
                  <span className="card-price">{fmt(p.price)}</span>
                  <button className="card-add" disabled={p.stock === 0} onClick={(e) => { e.stopPropagation(); addToCart(p, 1); }}>
                    {p.stock === 0 ? 'Indisponível' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {products.length === 0 && <p className="empty">Nenhuma peça nesta categoria no momento.</p>}
      </section>

      <footer className="footer">
        <div className="logo-ring small"><span>CM</span></div>
        <p>Charme de Mulher — semijoias que transformam qualquer look.</p>
        <p className="footer-ig">@charmedemulher.semijoias</p>
        <button className="admin-link" onClick={goAdmin}>Área do lojista</button>
      </footer>

      {detailProduct && (
        <div className="overlay" onClick={() => setDetailProduct(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailProduct(null)}>×</button>
            <div className="detail-visual">
              {detailProduct.image ? <img src={detailProduct.image} alt={detailProduct.name} /> : (CATEGORY_META[detailProduct.category] || CATEGORY_META.pulseiras).icon({ className: 'card-icon' })}
            </div>
            <span className="card-cat">{(CATEGORY_META[detailProduct.category] || CATEGORY_META.pulseiras).label}</span>
            <h2 className="detail-name">{detailProduct.name}</h2>
            <p className="detail-desc">{detailProduct.description}</p>
            <div className="detail-row">
              <span className="card-price big">{fmt(detailProduct.price)}</span>
              <span className="detail-stock">{detailProduct.stock > 0 ? `${detailProduct.stock} em estoque` : 'Esgotado'}</span>
            </div>
            <button className="hero-cta full" disabled={detailProduct.stock === 0} onClick={() => { addToCart(detailProduct, 1); setDetailProduct(null); }}>Adicionar ao carrinho</button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header"><h2>Seu carrinho</h2><button className="modal-close" onClick={() => setCartOpen(false)}>×</button></div>
            {cart.length === 0 ? <p className="empty">Seu carrinho está vazio.</p> : (
              <>
                <div className="cart-items">
                  {cart.map((i) => (
                    <div key={i.id} className="cart-item">
                      <div className="cart-item-info"><span className="cart-item-name">{i.name}</span><span className="cart-item-price">{fmt(i.price)}</span></div>
                      <div className="cart-item-qty">
                        <button onClick={() => updateQty(i.id, i.qty - 1)}>−</button>
                        <span>{i.qty}</span>
                        <button onClick={() => updateQty(i.id, i.qty + 1)}>+</button>
                      </div>
                      <button className="cart-item-remove" onClick={() => removeFromCart(i.id)}>Remover</button>
                    </div>
                  ))}
                </div>
                <div className="cart-total"><span>Total</span><span>{fmt(cartTotal)}</span></div>
                <button className="hero-cta full" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Finalizar pedido</button>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay" onClick={() => setCheckoutOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button>
            <CheckoutForm cartTotal={cartTotal} onSubmit={finalizeOrder} />
          </div>
        </div>
      )}

      {confirmedOrder && (
        <div className="overlay" onClick={() => setConfirmedOrder(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">✓</div>
            <h2>Pedido recebido!</h2>
            <p>Número do pedido: <strong>#{confirmedOrder.id}</strong></p>

            {confirmedOrder.customer.payment === 'Pix' && config.pixKey && (
              <div className="pix-box">
                <span className="pix-label">Chave Pix da loja</span>
                <div className="pix-row">
                  <code>{config.pixKey}</code>
                  <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(config.pixKey)}>Copiar</button>
                </div>
              </div>
            )}

            {confirmedOrder.customer.payment === 'Cartão' && config.cardPaymentLink && (
              <div className="pix-box">
                <span className="pix-label">Pagamento com cartão</span>
                <a
                  className="hero-cta full"
                  style={{ marginTop: 8 }}
                  target="_blank" rel="noopener noreferrer"
                  href={config.cardPaymentLink}
                >
                  Pagar com cartão de crédito ou débito
                </a>
              </div>
            )}

            <p className="confirm-note">Envie o comprovante e confirme os detalhes pelo WhatsApp da loja.</p>

            {config.whatsappNumber ? (
              <a
                className="hero-cta full whatsapp-cta"
                target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(buildWhatsAppMessage(confirmedOrder))}`}
              >
                Enviar pedido no WhatsApp
              </a>
            ) : (
              <p className="form-err">A loja ainda não configurou o número de WhatsApp no painel.</p>
            )}

            <button className="admin-back" onClick={() => setConfirmedOrder(null)}>Continuar comprando</button>
          </div>
        </div>
      )}

      {myOrdersOpen && <MyOrdersModal orders={orders} onClose={() => setMyOrdersOpen(false)} />}
    </div>
  );
}

function buildWhatsAppMessage(order) {
  const items = order.items.map((i) => `${i.qty}x ${i.name} (${fmt(i.price * i.qty)})`).join('\n');
  const entregaLinha = order.customer.deliveryMethod === 'retirada'
    ? 'Retirada no local'
    : `Entrega — Endereço: ${order.customer.address} (taxa de entrega: ${fmt(order.customer.deliveryFee || 0)})`;
  return `Olá! Fiz o pedido #${order.id} na Charme de Mulher:\n${items}\nTotal: ${fmt(order.total)}\nForma de pagamento: ${order.customer.payment}\nNome: ${order.customer.name}\n${entregaLinha}`;
}

function MyOrdersModal({ orders, onClose }) {
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const matches = orders.filter((o) => searched && onlyDigits(o.customer.phone) === onlyDigits(phone) && onlyDigits(phone).length > 0);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Meus pedidos</h2>
        <p className="admin-login-sub">Digite o WhatsApp usado na compra para ver o andamento dos seus pedidos.</p>
        <label>WhatsApp<input value={phone} onChange={(e) => { setPhone(e.target.value); setSearched(false); }} placeholder="(99) 99999-9999" /></label>
        <button className="hero-cta full" onClick={() => setSearched(true)}>Buscar</button>
        {searched && matches.length === 0 && <p className="empty">Nenhum pedido encontrado para esse número.</p>}
        {matches.length > 0 && (
          <div className="my-orders-list">
            {matches.map((o) => (
              <div key={o.id} className="order-card">
                <div className="my-order-row"><span>#{o.id}</span><span>{fmt(o.total)}</span><span className="status-pill">{o.status}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutForm({ cartTotal, onSubmit }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('entrega');
  const [payment, setPayment] = useState('Pix');
  const [err, setErr] = useState('');
  const deliveryFee = deliveryMethod === 'entrega' ? DELIVERY_FEE : 0;
  const finalTotal = cartTotal + deliveryFee;
  const submit = () => {
    if (!name.trim() || !phone.trim()) { setErr('Preencha nome e telefone para continuar.'); return; }
    if (deliveryMethod === 'entrega' && !address.trim()) { setErr('Preencha o endereço de entrega.'); return; }
    onSubmit({ name, phone, address: deliveryMethod === 'entrega' ? address : '', deliveryMethod, deliveryFee, payment });
  };
  return (
    <div className="checkout">
      <h2>Finalizar pedido</h2>
      <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label>
      <label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(99) 99999-9999" /></label>
      <label>Como deseja receber?
        <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
          <option value="entrega">Entrega (+ {fmt(DELIVERY_FEE)})</option>
          <option value="retirada">Retirada no local</option>
        </select>
      </label>
      {deliveryMethod === 'entrega' && (
        <label>Endereço de entrega<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" /></label>
      )}
      <label>Forma de pagamento
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option>Pix</option><option>Cartão</option>
        </select>
      </label>
      {err && <p className="form-err">{err}</p>}
      <div className="checkout-total"><span>Subtotal</span><span>{fmt(cartTotal)}</span></div>
      {deliveryMethod === 'entrega' && (
        <div className="checkout-total"><span>Taxa de entrega</span><span>{fmt(deliveryFee)}</span></div>
      )}
      <div className="checkout-total"><span>Total</span><span>{fmt(finalTotal)}</span></div>
      <button className="hero-cta full" onClick={submit}>Confirmar pedido</button>
    </div>
  );
}

function AdminLogin({ loginPass, setLoginPass, loginError, onBack, onSubmit }) {
  return (
    <div className="admin-login">
      <div className="logo-ring"><span>CM</span></div>
      <h1>Área do lojista</h1>
      <p className="admin-login-sub">Entre com a senha de administração para gerenciar produtos e pedidos.</p>
      <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSubmit()} placeholder="Senha" className="admin-login-input" />
      {loginError && <p className="form-err">{loginError}</p>}
      <button className="hero-cta full" onClick={onSubmit}>Entrar</button>
      <button className="admin-back" onClick={onBack}>Voltar para a loja</button>
    </div>
  );
}

/* ==================================================================== ADMIN */
function Admin({ products, orders, config, adminTab, setAdminTab, saveProduct, deleteProduct, adjustStock, updateOrderStatus, saveConfig, editingProduct, setEditingProduct, onExit }) {
  const blankProduct = { id: '', name: '', category: CAT_KEYS[0], price: '', stock: '', image: '', description: '' };

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const lowStock = products.filter((p) => p.stock <= 3);

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="brand">
          <div className="logo-ring small"><span>CM</span></div>
          <div className="brand-text"><div className="brand-name">Painel do lojista</div><div className="brand-tag">Charme de Mulher</div></div>
        </div>
        <button className="admin-back" onClick={onExit}>Sair para a loja</button>
      </header>

      <div className="admin-stats">
        <div className="stat"><span className="stat-label">Pedidos</span><span className="stat-value">{orders.length}</span></div>
        <div className="stat"><span className="stat-label">Faturamento</span><span className="stat-value">{fmt(totalRevenue)}</span></div>
        <div className="stat"><span className="stat-label">Produtos</span><span className="stat-value">{products.length}</span></div>
        <div className="stat"><span className="stat-label">Estoque baixo</span><span className="stat-value">{lowStock.length}</span></div>
      </div>

      <nav className="admin-tabs">
        <button className={adminTab === 'pedidos' ? 'active' : ''} onClick={() => setAdminTab('pedidos')}>Pedidos</button>
        <button className={adminTab === 'produtos' ? 'active' : ''} onClick={() => setAdminTab('produtos')}>Produtos e estoque</button>
        <button className={adminTab === 'config' ? 'active' : ''} onClick={() => setAdminTab('config')}>Configurações</button>
      </nav>

      {adminTab === 'pedidos' && (
        <section className="admin-orders">
          {orders.length === 0 && <p className="empty">Nenhum pedido ainda.</p>}
          {orders.map((o) => (
            <details key={o.id} className="order-card">
              <summary>
                <span>#{o.id} — {o.customer.name}</span>
                <span>{fmt(o.total)}</span>
                <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)} onClick={(e) => e.stopPropagation()}>
                  <option>Novo</option><option>Em preparo</option><option>Enviado</option><option>Entregue</option><option>Cancelado</option>
                </select>
              </summary>
              <div className="order-detail">
                <p><strong>WhatsApp:</strong> {o.customer.phone}</p>
                {o.customer.deliveryMethod === 'retirada' ? (
                  <p><strong>Recebimento:</strong> Retirada no local</p>
                ) : (
                  <>
                    <p><strong>Recebimento:</strong> Entrega (taxa: {fmt(o.customer.deliveryFee || 0)})</p>
                    <p><strong>Endereço:</strong> {o.customer.address}</p>
                  </>
                )}
                <p><strong>Pagamento:</strong> {o.customer.payment}</p>
                <ul>{o.items.map((i) => <li key={i.id}>{i.qty}x {i.name} — {fmt(i.price * i.qty)}</li>)}</ul>
              </div>
            </details>
          ))}
        </section>
      )}

      {adminTab === 'produtos' && (
        <section className="admin-products">
          <button className="hero-cta" onClick={() => setEditingProduct(blankProduct)}>+ Novo produto</button>
          <p className="admin-hint">Use os botões − / + para ajustar o estoque rapidamente quando vender pelo Instagram ou outro canal.</p>
          <div className="admin-product-list">
            {products.map((p) => {
              const meta = CATEGORY_META[p.category] || CATEGORY_META.pulseiras;
              return (
                <div key={p.id} className="admin-product-row">
                  <div className="admin-product-visual">{p.image ? <img src={p.image} alt={p.name} /> : meta.icon({ className: 'card-icon' })}</div>
                  <div className="admin-product-info"><span className="card-name">{p.name}</span><span className="card-cat">{meta.label}</span></div>
                  <span>{fmt(p.price)}</span>
                  <div className="stock-adjust">
                    <button onClick={() => adjustStock(p.id, -1)} title="Registrar venda fora do site">−</button>
                    <span className={p.stock <= 3 ? 'stock-low' : ''}>{p.stock} un.</span>
                    <button onClick={() => adjustStock(p.id, 1)} title="Repor estoque">+</button>
                  </div>
                  <div className="admin-product-actions">
                    <button onClick={() => setEditingProduct(p)}>Editar</button>
                    <button onClick={() => deleteProduct(p.id)}>Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {adminTab === 'config' && <SettingsForm config={config} onSave={saveConfig} />}

      {editingProduct && (
        <div className="overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingProduct(null)}>×</button>
            <ProductForm product={editingProduct} onSave={saveProduct} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({ product, onSave }) {
  const [form, setForm] = useState(product);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try { set('image', await resizeImage(file)); } catch {} finally { setUploading(false); }
  };

  return (
    <div className="checkout">
      <h2>{product.id ? 'Editar produto' : 'Novo produto'}</h2>
      <label>Nome<input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label>Categoria
        <select value={form.category} onChange={(e) => set('category', e.target.value)}>
          {CAT_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
        </select>
      </label>
      <label>Preço (R$)<input type="number" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
      <label>Estoque<input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></label>
      <label>Foto do produto
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>
      {uploading && <p className="admin-hint">Enviando foto…</p>}
      {form.image && (
        <div className="upload-preview-wrap">
          <img src={form.image} alt="preview" className="upload-preview" />
          <button type="button" className="text-link" onClick={() => set('image', '')}>Remover foto</button>
        </div>
      )}
      <label>Ou cole o link de uma imagem<input value={form.image && form.image.startsWith('data:') ? '' : form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://..." /></label>
      <label>Descrição<textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} /></label>
      <button className="hero-cta full" onClick={() => onSave(form)}>Salvar produto</button>
    </div>
  );
}

function SettingsForm({ config, onSave }) {
  const [whatsapp, setWhatsapp] = useState(config.whatsappNumber);
  const [pix, setPix] = useState(config.pixKey);
  const [cardLink, setCardLink] = useState(config.cardPaymentLink);
  const [about, setAbout] = useState(config.sobreTexto);
  const [savedMsg, setSavedMsg] = useState('');

  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passErr, setPassErr] = useState('');
  const [passMsg, setPassMsg] = useState('');

  const saveGeneral = async () => {
    const ok = await onSave({ ...config, whatsappNumber: onlyDigits(whatsapp), pixKey: pix, cardPaymentLink: cardLink, sobreTexto: about });
    if (ok) {
      setSavedMsg('Configurações salvas.');
    } else {
      setSavedMsg('Erro ao salvar — verifique a conexão com o banco de dados.');
    }
    setTimeout(() => setSavedMsg(''), 3500);
  };

  const changePassword = async () => {
    setPassMsg('');
    if (curPass !== config.adminPassword) { setPassErr('Senha atual incorreta.'); return; }
    if (newPass.length < 4) { setPassErr('A nova senha precisa ter ao menos 4 caracteres.'); return; }
    if (newPass !== confirmPass) { setPassErr('As senhas não coincidem.'); return; }
    await onSave({ ...config, adminPassword: newPass });
    setPassErr(''); setPassMsg('Senha alterada com sucesso.');
    setCurPass(''); setNewPass(''); setConfirmPass('');
  };

  return (
    <section className="admin-settings">
      <div className="settings-block">
        <h3>Loja</h3>
        <label>Número de WhatsApp da loja (só números, com DDI+DDD)<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5571999999999" /></label>
        <label>Chave Pix<input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" /></label>
        <label>Link de pagamento (cartão de crédito/débito)<input value={cardLink} onChange={(e) => setCardLink(e.target.value)} placeholder="https://... (Mercado Pago, InfinitePay, PagSeguro, etc.)" /></label>
        <label>Texto da seção "Sobre"<textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} /></label>
        {savedMsg && <p className="save-msg">{savedMsg}</p>}
        <button className="hero-cta" onClick={saveGeneral}>Salvar configurações</button>
      </div>

      <div className="settings-block">
        <h3>Alterar senha do painel</h3>
        <label>Senha atual<input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} /></label>
        <label>Nova senha<input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></label>
        <label>Confirmar nova senha<input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} /></label>
        {passErr && <p className="form-err">{passErr}</p>}
        {passMsg && <p className="save-msg">{passMsg}</p>}
        <button className="hero-cta" onClick={changePassword}>Alterar senha</button>
      </div>
    </section>
  );
}

/* ==================================================================== ESTILO */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500;600&display=swap');

      .cdm-root { --bg:#15120F; --bg-soft:#1D1814; --gold:#C9A567; --gold-soft:#B08F55; --cream:#F3ECE1; --muted:#B8AA98; --rose:#8C5A50; --danger:#D98B7A;
        font-family:'Jost',sans-serif; background:var(--bg); color:var(--cream); min-height:100vh; }
      .cdm-root * { box-sizing:border-box; }
      .cdm-root h1,.cdm-root h2,.cdm-root h3 { font-family:'Cormorant Garamond',serif; font-weight:500; margin:0; }
      .cdm-root button { font-family:'Jost',sans-serif; cursor:pointer; }
      .cdm-root input,.cdm-root select,.cdm-root textarea { font-family:'Jost',sans-serif; }

      .banner-warn { background:#3A2A20; color:#E9C9A6; text-align:center; padding:8px; font-size:13px; }

      .header { display:flex; align-items:center; justify-content:space-between; padding:22px 28px; }
      .brand { display:flex; align-items:center; gap:12px; }
      .header-actions { display:flex; align-items:center; gap:16px; }
      .text-link { background:none; border:none; color:var(--muted); font-size:13px; text-decoration:underline; }
      .logo-ring { width:52px; height:52px; border-radius:50%; border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; color:var(--gold); font-family:'Cormorant Garamond',serif; font-size:20px; letter-spacing:1px; flex-shrink:0; }
      .logo-ring.small { width:38px; height:38px; font-size:15px; }
      .brand-name { font-family:'Cormorant Garamond',serif; font-size:20px; letter-spacing:0.5px; }
      .brand-tag { font-size:11px; letter-spacing:3px; text-transform:uppercase; color:var(--gold); }
      .cart-btn { position:relative; background:none; border:1px solid #3a332b; color:var(--cream); width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
      .cart-count { position:absolute; top:-4px; right:-4px; background:var(--gold); color:#1a1510; font-size:11px; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; }

      .hero { position:relative; text-align:center; padding:70px 24px 40px; overflow:hidden; }
      .hero-ring { position:absolute; border:1px solid rgba(201,165,103,0.25); border-radius:50%; width:420px; height:420px; top:-140px; left:50%; transform:translateX(-50%); animation:spin 60s linear infinite; }
      .hero-ring-2 { width:300px; height:300px; top:-80px; animation-duration:80s; animation-direction:reverse; border-color:rgba(201,165,103,0.15); }
      @keyframes spin { from{transform:translateX(-50%) rotate(0deg);} to{transform:translateX(-50%) rotate(360deg);} }
      @media (prefers-reduced-motion: reduce) { .hero-ring { animation:none; } }
      .hero-eyebrow { position:relative; letter-spacing:4px; text-transform:uppercase; font-size:11px; color:var(--gold); margin-bottom:14px; }
      .hero-title { position:relative; font-size:44px; line-height:1.15; margin-bottom:16px; }
      .hero-sub { position:relative; color:var(--muted); max-width:380px; margin:0 auto 26px; font-size:15px; }
      .hero-cta { position:relative; display:inline-block; background:var(--gold); color:#1a1510; border:none; padding:13px 30px; border-radius:2px; font-size:13px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:none; font-weight:500; }
      .hero-cta.full { display:block; width:100%; text-align:center; margin-top:14px; }
      .hero-cta:disabled { opacity:0.4; cursor:not-allowed; }
      .whatsapp-cta { background:#3EA25E; color:#0d1a10; }

      .about { max-width:560px; margin:0 auto; text-align:center; padding:0 24px 44px; }
      .about p { font-family:'Cormorant Garamond',serif; font-size:19px; line-height:1.6; color:var(--muted); font-style:italic; }

      .filters { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; padding:0 20px 30px; }
      .filter-chip { background:none; border:1px solid #3a332b; color:var(--muted); padding:8px 18px; border-radius:20px; font-size:13px; letter-spacing:0.5px; }
      .filter-chip.active { border-color:var(--gold); color:var(--gold); }

      .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:20px; padding:0 28px 60px; max-width:1200px; margin:0 auto; }
      .card { background:var(--bg-soft); border:1px solid #2a241d; border-radius:4px; overflow:hidden; cursor:pointer; transition:border-color .2s; }
      .card:hover { border-color:var(--gold-soft); }
      .card-visual { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 30% 20%, #2a231b, #16120e); }
      .card-visual img { width:100%; height:100%; object-fit:cover; }
      .card-icon { width:56px; height:56px; color:var(--gold-soft); }
      .badge-out { position:absolute; top:10px; right:10px; background:#2a241d; color:var(--danger); font-size:10px; padding:3px 8px; border-radius:10px; letter-spacing:0.5px; }
      .card-body { padding:16px; }
      .card-cat { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--gold); }
      .card-name { font-size:19px; margin:6px 0 12px; }
      .card-row { display:flex; align-items:center; justify-content:space-between; }
      .card-price { font-size:15px; color:var(--cream); }
      .card-price.big { font-size:26px; font-family:'Cormorant Garamond',serif; color:var(--gold); }
      .card-add { background:none; border:1px solid var(--gold-soft); color:var(--gold); padding:7px 14px; font-size:11px; letter-spacing:0.5px; border-radius:2px; }
      .card-add:disabled { opacity:0.35; border-color:#3a332b; color:var(--muted); }
      .empty { text-align:center; color:var(--muted); padding:40px 0; grid-column:1/-1; }

      .footer { text-align:center; padding:40px 20px 50px; border-top:1px solid #2a241d; color:var(--muted); font-size:13px; }
      .footer .logo-ring { margin:0 auto 14px; }
      .footer-ig { color:var(--gold-soft); margin-top:4px; }
      .admin-link { background:none; border:none; color:var(--muted); text-decoration:underline; margin-top:18px; font-size:12px; }

      .overlay { position:fixed; inset:0; background:rgba(10,8,6,0.7); display:flex; align-items:center; justify-content:center; z-index:50; padding:16px; }
      .modal { background:var(--bg-soft); border:1px solid #332c22; border-radius:6px; padding:32px; max-width:420px; width:100%; max-height:85vh; overflow-y:auto; position:relative; }
      .modal-close { position:absolute; top:14px; right:16px; background:none; border:none; color:var(--muted); font-size:22px; line-height:1; }
      .detail-modal { text-align:left; }
      .detail-visual { aspect-ratio:1.4; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 30% 20%, #2a231b, #16120e); border-radius:4px; margin-bottom:16px; overflow:hidden; }
      .detail-visual img { width:100%; height:100%; object-fit:cover; }
      .detail-name { font-size:26px; margin:8px 0 10px; }
      .detail-desc { color:var(--muted); font-size:14px; line-height:1.6; margin-bottom:16px; }
      .detail-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
      .detail-stock { font-size:12px; color:var(--muted); }

      .cart-drawer { position:fixed; top:0; right:0; bottom:0; width:380px; max-width:92vw; background:var(--bg-soft); padding:26px; overflow-y:auto; border-left:1px solid #332c22; }
      .cart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
      .cart-items { display:flex; flex-direction:column; gap:16px; margin-bottom:20px; }
      .cart-item { border-bottom:1px solid #2a241d; padding-bottom:14px; }
      .cart-item-info { display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; }
      .cart-item-qty { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
      .cart-item-qty button { background:none; border:1px solid #3a332b; color:var(--cream); width:26px; height:26px; border-radius:50%; }
      .cart-item-remove { background:none; border:none; color:var(--danger); font-size:11px; text-decoration:underline; padding:0; }
      .cart-total { display:flex; justify-content:space-between; font-size:16px; padding-top:10px; border-top:1px solid #3a332b; margin-bottom:6px; }

      .checkout label,.admin-login label,.admin-settings label { display:block; font-size:12px; color:var(--muted); margin-bottom:14px; }
      .checkout input,.checkout select,.checkout textarea,.admin-login-input,.admin-settings input,.admin-settings textarea { width:100%; background:#0F0C09; border:1px solid #3a332b; color:var(--cream); padding:10px 12px; border-radius:3px; margin-top:6px; font-size:14px; }
      .checkout-total { display:flex; justify-content:space-between; font-size:16px; margin:16px 0; padding-top:10px; border-top:1px solid #3a332b; }
      .form-err { color:var(--danger); font-size:12px; margin:-6px 0 12px; }
      .save-msg { color:#8FCB9F; font-size:12px; margin:-6px 0 12px; }

      .confirm-modal { text-align:center; }
      .confirm-icon { width:48px; height:48px; border-radius:50%; border:1px solid var(--gold); color:var(--gold); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:20px; }
      .confirm-note { color:var(--muted); font-size:13px; margin:10px 0 16px; }
      .pix-box { background:#0F0C09; border:1px solid #3a332b; border-radius:4px; padding:14px; margin-bottom:16px; text-align:left; }
      .pix-label { font-size:11px; color:var(--gold); text-transform:uppercase; letter-spacing:1px; }
      .pix-row { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px; }
      .pix-row code { font-size:13px; word-break:break-all; color:var(--cream); }
      .pix-row button { background:none; border:1px solid var(--gold-soft); color:var(--gold); padding:5px 12px; border-radius:3px; font-size:12px; flex-shrink:0; }

      .admin-login { max-width:340px; margin:80px auto; text-align:center; padding:20px; }
      .admin-login .logo-ring { margin:0 auto 20px; }
      .admin-login h1 { font-size:26px; margin-bottom:8px; }
      .admin-login-sub { color:var(--muted); font-size:13px; margin-bottom:20px; }
      .admin-back { background:none; border:none; color:var(--muted); text-decoration:underline; margin-top:14px; font-size:12px; }

      .admin { padding:24px 28px 60px; max-width:1100px; margin:0 auto; }
      .admin-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:26px; }
      .admin-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:14px; margin-bottom:30px; }
      .stat { background:var(--bg-soft); border:1px solid #2a241d; border-radius:4px; padding:16px; }
      .stat-label { display:block; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
      .stat-value { font-family:'Cormorant Garamond',serif; font-size:26px; color:var(--gold); }
      .admin-tabs { display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid #2a241d; }
      .admin-tabs button { background:none; border:none; color:var(--muted); padding:10px 4px; margin-right:20px; border-bottom:2px solid transparent; font-size:14px; }
      .admin-tabs button.active { color:var(--gold); border-color:var(--gold); }
      .admin-hint { color:var(--muted); font-size:12px; margin:8px 0 16px; }
      .order-card { background:var(--bg-soft); border:1px solid #2a241d; border-radius:4px; margin-bottom:10px; padding:14px 16px; }
      .order-card summary { display:flex; justify-content:space-between; align-items:center; gap:12px; cursor:pointer; list-style:none; font-size:14px; flex-wrap:wrap; }
      .order-card summary::-webkit-details-marker { display:none; }
      .order-card select { background:#0F0C09; color:var(--cream); border:1px solid #3a332b; padding:5px 8px; border-radius:3px; font-size:12px; }
      .order-detail { margin-top:12px; padding-top:12px; border-top:1px solid #2a241d; font-size:13px; color:var(--muted); }
      .order-detail ul { margin:8px 0 0; padding-left:18px; }
      .my-order-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; }
      .status-pill { background:#0F0C09; border:1px solid var(--gold-soft); color:var(--gold); padding:3px 10px; border-radius:12px; font-size:11px; }
      .admin-products .hero-cta { margin-bottom:10px; }
      .admin-product-list { display:flex; flex-direction:column; gap:10px; }
      .admin-product-row { display:grid; grid-template-columns:56px 1fr auto auto auto; align-items:center; gap:14px; background:var(--bg-soft); border:1px solid #2a241d; border-radius:4px; padding:10px 14px; font-size:13px; }
      .admin-product-visual { width:56px; height:56px; border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 30% 20%, #2a231b, #16120e); }
      .admin-product-visual img { width:100%; height:100%; object-fit:cover; }
      .admin-product-visual .card-icon { width:28px; height:28px; }
      .admin-product-info { display:flex; flex-direction:column; }
      .admin-product-actions { display:flex; gap:8px; }
      .admin-product-actions button { background:none; border:1px solid #3a332b; color:var(--muted); padding:5px 10px; border-radius:3px; font-size:12px; }
      .stock-adjust { display:flex; align-items:center; gap:8px; }
      .stock-adjust button { background:none; border:1px solid #3a332b; color:var(--cream); width:24px; height:24px; border-radius:50%; font-size:14px; line-height:1; }
      .stock-low { color:var(--danger); }
      .upload-preview-wrap { display:flex; align-items:center; gap:12px; margin:-8px 0 14px; }
      .upload-preview { width:56px; height:56px; object-fit:cover; border-radius:4px; border:1px solid #3a332b; }
      .admin-settings { display:flex; flex-direction:column; gap:26px; max-width:480px; }
      .settings-block { background:var(--bg-soft); border:1px solid #2a241d; border-radius:4px; padding:20px; }
      .settings-block h3 { font-size:19px; margin-bottom:14px; }

      @media (max-width:640px) {
        .hero-title { font-size:32px; }
        .admin-product-row { grid-template-columns:44px 1fr; }
        .admin-product-actions,.stock-adjust { grid-column:1/-1; }
      }
    `}</style>
  );
}

