'use client';

import React from 'react';
import DevicesMapClient from '@/app/admin/devices/DevicesMapClient';

// Pour l’instant pas de props spécifiques, mais on garde le type prêt à évoluer
export type DevicesViewProps = Record<string, never>;

const DevicesView: React.FC<DevicesViewProps> = () => {
  // Vue unique "Admin global" YGC-ADMIN, avec la carte premium GuardCloud
  return <DevicesMapClient />;
};

export default DevicesView;
