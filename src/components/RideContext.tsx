import React, { createContext, useContext, useState } from 'react';

const RideContext = createContext<any>(null);

export const RideProvider = ({ children }: { children: React.ReactNode }) => {
  // بيانات الراكب الحقيقية الافتراضية أو التي تسجلت
  const [passenger, setPassenger] = useState({
    name: 'محمود أحمد',
    phone: '01012345678',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  });

  // حالة المشوار (هل تم الطلب؟ هل تم القبول؟)
  const [rideStatus, setRideStatus] = useState<'idle' | 'requested' | 'accepted'>('requested');

  // بيانات الكابتن (لتظهر للراكب عندما يقبل الكابتن المشوار)
  const [captain, setCaptain] = useState({
    name: 'الكابتن / ياسر',
    phone: '01009524383',
    carDetails: 'بي واي دي - إف 3 (موتور لانسر)',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
  });

  return (
    <RideContext.Provider value={{ passenger, setPassenger, rideStatus, setRideStatus, captain, setCaptain }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => useContext(RideContext);