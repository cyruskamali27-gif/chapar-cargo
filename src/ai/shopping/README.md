# src/ai/shopping — Shopping AI
**Purpose:** Product identification, vague->grid, variants, brand theming, price estimate.
**Future APIs:** /api/product/search (distinct models), /api/product/variants (colors/sizes), /api/product/price (cheapest-across-countries estimate).
**Safety:** Extraction partial — traveler confirms SKU. Never present AI price as final (real price = bids). No pixel-cloning merchant sites.
**Data:** query/photo/link, country, category.
**Outputs:** {title,brand,image(URL preferred),priceUSD,link,seller}; variants by color; standard size sets per category.
