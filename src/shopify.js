import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_URL = `https://${STORE_DOMAIN}/admin/api/2024-10/graphql.json`;

if (!STORE_DOMAIN || !ADMIN_TOKEN) {
  console.warn('[WARN] Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
}

async function shopifyGraphQL(query, variables = {}) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ADMIN_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors || json));
      }
      return json.data;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

const VARIANT_LOOKUP = `#graphql
  query VariantByBarcode($q: String!) {
    productVariants(first: 1, query: $q) {
      edges {
        node {
          id
          title
          sku
          barcode
          price
          image { url }
          inventoryItem { id }
          product {
            id
            title
            featuredImage { url }
            tags
          }
        }
      }
    }
  }
`;

export async function lookupVariantByBarcode(barcode) {
  const data = await shopifyGraphQL(VARIANT_LOOKUP, { q: `barcode:${barcode}` });
  const edge = data.productVariants.edges[0];
  return edge ? edge.node : null;
}

const ADD_TAG = `#graphql
  mutation AddTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { field message }
    }
  }
`;

export async function addTagToProduct(productGid, tag) {
  const data = await shopifyGraphQL(ADD_TAG, { id: productGid, tags: [tag] });
  const errs = data.tagsAdd.userErrors;
  if (errs && errs.length) throw new Error('tagsAdd error: ' + JSON.stringify(errs));
  return true;
}

export async function getInventoryLevels(inventoryItemId) {
  const Q = `#graphql
    query InventoryByItem($id: ID!) {
      inventoryItem(id: $id) {
        id
        inventoryLevels(first: 50) {
          edges {
            node {
              available
              location { id name }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(Q, { id: inventoryItemId });
  const edges = data.inventoryItem.inventoryLevels.edges || [];
  return edges.map(e => e.node);
}
