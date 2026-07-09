import { useState, useEffect } from 'react';
import axios from 'axios';

const DEFAULT_CONFIG = {
  shopName: 'The Classic Cut',
  tagline: '',
  logoUrl: '',
  heroImageUrl: '',
  galleryImages: [],
  barbers: [],
  address: '',
  phone: '',
  hours: {},
  socialLinks: {},
  smsEnabled: false,
  vapidPublicKey: '',
};

export function useShopConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    axios.get('/api/config')
      .then(res => setConfig({ ...DEFAULT_CONFIG, ...res.data }))
      .catch(() => {});
  }, []);

  return config;
}
