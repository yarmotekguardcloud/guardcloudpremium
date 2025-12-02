'use client';

import React from 'react';
import DevicesMapClient from '@/app/admin/devices/DevicesMapClient';

export type DevicesViewMode = 'client' | 'reseller' | 'global';

/**
 * Vue générique réutilisable pour:
 *  - /admin/devices           (mode = "global")
 *  - /admin/clients/[id]      (mode = "client")
 *  - /admin/resellers/[id]    (mode = "reseller")
 *
 * Pour l’instant, on ne filtre pas encore par client / revendeur :
 * on affiche la même Live Map Premium.
 * Plus tard on utilisera mode/clientId/resellerId pour filtrer côté API.
 */
export type DevicesViewProps = {
  mode?: DevicesViewMode;
  title?: string;
  subtitle?: string;
  clientId?: string;
  resellerId?: string;
};

const DevicesView: React.FC<DevicesViewProps> = (_props) => {
  // TODO (plus tard) : utiliser _props.mode, _props.clientId, etc.
  // pour appeler une API filtrée.
  return <DevicesMapClient />;
};

export default DevicesView;
