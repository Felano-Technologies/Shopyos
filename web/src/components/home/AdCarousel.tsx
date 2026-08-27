import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Store, Gift } from 'lucide-react';
import { useActiveBanners } from '../../hooks/useBanners';
import { recordAdClick } from '../../services/advertising';

const AUTO_ROTATE_MS = 5000;

const SidePromoCard: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  sub: string;
  gradient: string;
  route: string;
}> = ({ icon: Icon, label, sub, gradient, route }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(route)}
      className={`flex-1 rounded-lg bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between text-left min-h-[92px] hover:opacity-90 transition-opacity`}
    >
      <Icon size={20} className="text-white/70" />
      <div>
        <p className="text-white font-bold text-sm leading-tight">{label}</p>
        <p className="text-white/70 text-xs">{sub}</p>
      </div>
    </button>
  );
};

export const AdCarousel: React.FC = () => {
  const { data: banners } = useActiveBanners();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const ads = banners || [];

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % ads.length), AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  useEffect(() => {
    if (index >= ads.length) setIndex(0);
  }, [ads.length, index]);

  const ad = ads[index] || ads[0];

  const handleClick = () => {
    if (!ad) return;
    recordAdClick(ad.id).catch(() => null);
    if (ad.product?.id) navigate(`/product/${ad.product.id}`);
    else navigate('/stores');
  };

  return (
    <section className="flex flex-col lg:flex-row gap-4">
      {/* Main ad — carousel of active campaigns, or an "ad space available" placeholder */}
      {ads.length === 0 ? (
        <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 h-40 lg:h-72 lg:flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <div className="bg-white border border-gray-200 rounded-full px-2.5 py-1">
            <span className="text-[10px] font-bold text-subtle tracking-wider uppercase">Ads</span>
          </div>
          <p className="text-sm font-semibold text-subtle">Your campaign could be here</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg h-40 lg:h-72 lg:flex-1">
          <button onClick={handleClick} className="block w-full h-full text-left" aria-label={ad.title}>
            <img src={ad.banner_url} alt={ad.title} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 md:p-6">
              <span className="text-[10px] font-bold text-white/70 tracking-wider uppercase">Sponsored</span>
              <h3 className="text-white font-bold text-lg md:text-2xl leading-tight">{ad.title}</h3>
            </div>
          </button>
          {ads.length > 1 && (
            <div className="absolute bottom-2 right-3 flex gap-1.5">
              {ads.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                  aria-label={`Show ad ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
            <Megaphone size={11} className="text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Ad</span>
          </div>
        </div>
      )}

      {/* Side promos — desktop only, gives the wide layout real content instead of a stretched single banner */}
      <div className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
        <SidePromoCard icon={Store} label="Sell on Shopyos" sub="Reach thousands of buyers" gradient="from-navy to-navy-mid" route="/register" />
        <SidePromoCard icon={Gift} label="Today's Deals" sub="Save on top picks" gradient="from-rose-500 to-rose-700" route="/deals" />
      </div>
    </section>
  );
};
