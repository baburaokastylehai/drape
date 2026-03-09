export type BrandSegment = "apparel" | "footwear" | "accessories" | "lifestyle" | "marketplace" | "luxury" | "outdoor" | "basics";

export type BrandRecord = {
  name: string;
  segment: BrandSegment;
  domains: string[];
};

export const brandCatalog: BrandRecord[] = [
  // Athletic / Footwear
  { name: "Nike", segment: "footwear", domains: ["nike.com"] },
  { name: "Adidas", segment: "footwear", domains: ["adidas.com"] },
  { name: "Puma", segment: "footwear", domains: ["puma.com"] },
  { name: "New Balance", segment: "footwear", domains: ["newbalance.com"] },
  { name: "Reebok", segment: "footwear", domains: ["reebok.com"] },
  { name: "ASICS", segment: "footwear", domains: ["asics.com"] },
  { name: "Hoka", segment: "footwear", domains: ["hoka.com"] },
  { name: "On Running", segment: "footwear", domains: ["on-running.com"] },
  { name: "Saucony", segment: "footwear", domains: ["saucony.com"] },
  { name: "Converse", segment: "footwear", domains: ["converse.com"] },
  { name: "Vans", segment: "footwear", domains: ["vans.com"] },
  { name: "Dr. Martens", segment: "footwear", domains: ["drmartens.com"] },
  { name: "Birkenstock", segment: "footwear", domains: ["birkenstock.com"] },
  { name: "Clarks", segment: "footwear", domains: ["clarks.com", "clarksusa.com"] },
  { name: "Cole Haan", segment: "footwear", domains: ["colehaan.com"] },
  { name: "Steve Madden", segment: "footwear", domains: ["stevemadden.com"] },
  { name: "Skechers", segment: "footwear", domains: ["skechers.com"] },
  { name: "Crocs", segment: "footwear", domains: ["crocs.com"] },
  { name: "Stuart Weitzman", segment: "footwear", domains: ["stuartweitzman.com"] },

  // Fast Fashion
  { name: "Zara", segment: "apparel", domains: ["zara.com"] },
  { name: "H&M", segment: "apparel", domains: ["hm.com", "email.hm.com"] },
  { name: "Uniqlo", segment: "apparel", domains: ["uniqlo.com"] },
  { name: "Forever 21", segment: "apparel", domains: ["forever21.com"] },
  { name: "Shein", segment: "apparel", domains: ["shein.com", "sheingroup.com"] },
  { name: "Temu", segment: "marketplace", domains: ["temu.com"] },
  { name: "Boohoo", segment: "apparel", domains: ["boohoo.com"] },
  { name: "PrettyLittleThing", segment: "apparel", domains: ["prettylittlething.com"] },
  { name: "Fashion Nova", segment: "apparel", domains: ["fashionnova.com"] },
  { name: "Romwe", segment: "apparel", domains: ["romwe.com"] },
  { name: "Mango", segment: "apparel", domains: ["mango.com"] },
  { name: "COS", segment: "apparel", domains: ["cos.com", "cosstores.com"] },
  { name: "& Other Stories", segment: "apparel", domains: ["stories.com"] },
  { name: "Arket", segment: "apparel", domains: ["arket.com"] },
  { name: "Massimo Dutti", segment: "apparel", domains: ["massimodutti.com"] },
  { name: "Primark", segment: "apparel", domains: ["primark.com"] },

  // Mid-range
  { name: "Gap", segment: "apparel", domains: ["gap.com"] },
  { name: "Banana Republic", segment: "apparel", domains: ["bananarepublic.com", "bananarepublic.gap.com"] },
  { name: "Old Navy", segment: "apparel", domains: ["oldnavy.com", "oldnavy.gap.com"] },
  { name: "Athleta", segment: "lifestyle", domains: ["athleta.com", "athleta.gap.com"] },
  { name: "J.Crew", segment: "apparel", domains: ["jcrew.com"] },
  { name: "Express", segment: "apparel", domains: ["express.com"] },
  { name: "Ann Taylor", segment: "apparel", domains: ["anntaylor.com"] },
  { name: "LOFT", segment: "apparel", domains: ["loft.com"] },
  { name: "Everlane", segment: "apparel", domains: ["everlane.com"] },
  { name: "Abercrombie", segment: "apparel", domains: ["abercrombie.com"] },
  { name: "Hollister", segment: "apparel", domains: ["hollisterco.com"] },
  { name: "American Eagle", segment: "apparel", domains: ["ae.com", "americaneagle.com"] },
  { name: "Aerie", segment: "basics", domains: ["aerie.com"] },
  { name: "PacSun", segment: "apparel", domains: ["pacsun.com"] },
  { name: "Aeropostale", segment: "apparel", domains: ["aeropostale.com"] },

  // Premium
  { name: "Ralph Lauren", segment: "apparel", domains: ["ralphlauren.com"] },
  { name: "Calvin Klein", segment: "apparel", domains: ["calvinklein.com"] },
  { name: "Tommy Hilfiger", segment: "apparel", domains: ["tommy.com", "tommyhilfiger.com"] },
  { name: "Theory", segment: "apparel", domains: ["theory.com"] },
  { name: "Vince", segment: "apparel", domains: ["vince.com"] },
  { name: "Club Monaco", segment: "apparel", domains: ["clubmonaco.com"] },
  { name: "Reiss", segment: "apparel", domains: ["reiss.com"] },
  { name: "AllSaints", segment: "apparel", domains: ["allsaints.com"] },
  { name: "Ted Baker", segment: "apparel", domains: ["tedbaker.com"] },
  { name: "Hugo Boss", segment: "apparel", domains: ["hugoboss.com", "boss.com"] },
  { name: "Bonobos", segment: "apparel", domains: ["bonobos.com"] },
  { name: "Brooks Brothers", segment: "apparel", domains: ["brooksbrothers.com"] },
  { name: "Charles Tyrwhitt", segment: "apparel", domains: ["ctshirts.com", "charlestyrwhitt.com"] },
  { name: "Scotch & Soda", segment: "apparel", domains: ["scotch-soda.com"] },
  { name: "Lacoste", segment: "apparel", domains: ["lacoste.com"] },
  { name: "Fred Perry", segment: "apparel", domains: ["fredperry.com"] },
  { name: "Paul Smith", segment: "apparel", domains: ["paulsmith.com"] },

  // Lifestyle / Active
  { name: "Lululemon", segment: "lifestyle", domains: ["lululemon.com"] },
  { name: "Under Armour", segment: "lifestyle", domains: ["underarmour.com"] },
  { name: "Alo Yoga", segment: "lifestyle", domains: ["aloyoga.com"] },
  { name: "Gymshark", segment: "lifestyle", domains: ["gymshark.com"] },
  { name: "Fabletics", segment: "lifestyle", domains: ["fabletics.com"] },
  { name: "Vuori", segment: "lifestyle", domains: ["vuori.com"] },
  { name: "Outdoor Voices", segment: "lifestyle", domains: ["outdoorvoices.com"] },

  // Outdoor
  { name: "Patagonia", segment: "outdoor", domains: ["patagonia.com"] },
  { name: "The North Face", segment: "outdoor", domains: ["thenorthface.com"] },
  { name: "Columbia", segment: "outdoor", domains: ["columbia.com"] },
  { name: "Arc'teryx", segment: "outdoor", domains: ["arcteryx.com"] },
  { name: "REI", segment: "marketplace", domains: ["rei.com"] },
  { name: "Fjallraven", segment: "outdoor", domains: ["fjallraven.com"] },
  { name: "Carhartt", segment: "apparel", domains: ["carhartt.com"] },

  // Urban / Young
  { name: "Urban Outfitters", segment: "apparel", domains: ["urbanoutfitters.com"] },
  { name: "Free People", segment: "apparel", domains: ["freepeople.com"] },
  { name: "Anthropologie", segment: "apparel", domains: ["anthropologie.com"] },
  { name: "Stussy", segment: "apparel", domains: ["stussy.com"] },
  { name: "Supreme", segment: "apparel", domains: ["supremenewyork.com"] },
  { name: "Kith", segment: "apparel", domains: ["kith.com"] },

  // Luxury
  { name: "Gucci", segment: "luxury", domains: ["gucci.com"] },
  { name: "Prada", segment: "luxury", domains: ["prada.com"] },
  { name: "Louis Vuitton", segment: "luxury", domains: ["louisvuitton.com"] },
  { name: "Burberry", segment: "luxury", domains: ["burberry.com"] },
  { name: "Versace", segment: "luxury", domains: ["versace.com"] },
  { name: "Balenciaga", segment: "luxury", domains: ["balenciaga.com"] },
  { name: "Saint Laurent", segment: "luxury", domains: ["ysl.com"] },
  { name: "Givenchy", segment: "luxury", domains: ["givenchy.com"] },
  { name: "Valentino", segment: "luxury", domains: ["valentino.com"] },
  { name: "Bottega Veneta", segment: "luxury", domains: ["bottegaveneta.com"] },
  { name: "Celine", segment: "luxury", domains: ["celine.com"] },
  { name: "Dior", segment: "luxury", domains: ["dior.com"] },
  { name: "Fendi", segment: "luxury", domains: ["fendi.com"] },
  { name: "Moncler", segment: "luxury", domains: ["moncler.com"] },
  { name: "Acne Studios", segment: "luxury", domains: ["acnestudios.com"] },

  // Bags & Accessories
  { name: "Coach", segment: "accessories", domains: ["coach.com"] },
  { name: "Kate Spade", segment: "accessories", domains: ["katespade.com"] },
  { name: "Michael Kors", segment: "accessories", domains: ["michaelkors.com"] },
  { name: "Tory Burch", segment: "accessories", domains: ["toryburch.com"] },
  { name: "Fossil", segment: "accessories", domains: ["fossil.com"] },
  { name: "Dooney & Bourke", segment: "accessories", domains: ["dooney.com"] },
  { name: "Warby Parker", segment: "accessories", domains: ["warbyparker.com"] },
  { name: "Ray-Ban", segment: "accessories", domains: ["ray-ban.com"] },

  // Basics / Lingerie
  { name: "Victoria's Secret", segment: "basics", domains: ["victoriassecret.com"] },
  { name: "Skims", segment: "basics", domains: ["skims.com"] },
  { name: "ThirdLove", segment: "basics", domains: ["thirdlove.com"] },
  { name: "Bombas", segment: "basics", domains: ["bombas.com"] },
  { name: "MeUndies", segment: "basics", domains: ["meundies.com"] },

  // Denim
  { name: "Levi's", segment: "apparel", domains: ["levis.com", "levi.com"] },
  { name: "Wrangler", segment: "apparel", domains: ["wrangler.com"] },
  { name: "AG Jeans", segment: "apparel", domains: ["agjeans.com"] },
  { name: "Frame", segment: "apparel", domains: ["frame-store.com"] },
  { name: "Citizens of Humanity", segment: "apparel", domains: ["citizensofhumanity.com"] },
  { name: "7 For All Mankind", segment: "apparel", domains: ["7forallmankind.com"] },

  // Marketplaces
  { name: "Amazon", segment: "marketplace", domains: ["amazon.com"] },
  { name: "Nordstrom", segment: "marketplace", domains: ["nordstrom.com", "nordstromrack.com"] },
  { name: "ASOS", segment: "marketplace", domains: ["asos.com"] },
  { name: "SSENSE", segment: "marketplace", domains: ["ssense.com"] },
  { name: "Mr Porter", segment: "marketplace", domains: ["mrporter.com"] },
  { name: "Net-a-Porter", segment: "marketplace", domains: ["net-a-porter.com"] },
  { name: "Farfetch", segment: "marketplace", domains: ["farfetch.com"] },
  { name: "END", segment: "marketplace", domains: ["endclothing.com"] },
  { name: "Revolve", segment: "marketplace", domains: ["revolve.com"] },
  { name: "Shopbop", segment: "marketplace", domains: ["shopbop.com"] },
  { name: "Grailed", segment: "marketplace", domains: ["grailed.com"] },
  { name: "StockX", segment: "marketplace", domains: ["stockx.com"] },
  { name: "GOAT", segment: "marketplace", domains: ["goat.com"] },
  { name: "Depop", segment: "marketplace", domains: ["depop.com"] },
  { name: "Poshmark", segment: "marketplace", domains: ["poshmark.com"] },
  { name: "ThredUp", segment: "marketplace", domains: ["thredup.com"] },
  { name: "The RealReal", segment: "marketplace", domains: ["therealreal.com"] },
  { name: "eBay", segment: "marketplace", domains: ["ebay.com"] },
  { name: "Etsy", segment: "marketplace", domains: ["etsy.com"] },
  { name: "Zappos", segment: "marketplace", domains: ["zappos.com"] },
  { name: "6pm", segment: "marketplace", domains: ["6pm.com"] },

  // Department Stores
  { name: "Target", segment: "marketplace", domains: ["target.com"] },
  { name: "Walmart", segment: "marketplace", domains: ["walmart.com"] },
  { name: "Macy's", segment: "marketplace", domains: ["macys.com"] },
  { name: "Bloomingdale's", segment: "marketplace", domains: ["bloomingdales.com"] },
  { name: "Saks", segment: "marketplace", domains: ["saksfifthavenue.com", "saks.com"] },
  { name: "Neiman Marcus", segment: "marketplace", domains: ["neimanmarcus.com"] },
  { name: "Kohl's", segment: "marketplace", domains: ["kohls.com"] },
  { name: "JCPenney", segment: "marketplace", domains: ["jcpenney.com"] },
  { name: "TJ Maxx", segment: "marketplace", domains: ["tjmaxx.com", "tjx.com"] },
  { name: "Costco", segment: "marketplace", domains: ["costco.com"] },

  // Shopify / Generic
  { name: "Shop", segment: "marketplace", domains: ["shop.app", "shopify.com"] }
];
