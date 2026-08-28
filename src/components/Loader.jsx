import React, { useState, useEffect, useRef } from 'react';
    const Loader = ({ text = "Memuat data..." }) => (
      <div className="flex flex-col justify-center items-center p-12 space-y-4 w-full">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-200 border-t-blue-600 shadow-sm"></div>
        <p className="text-slate-500 font-medium animate-pulse">{text}</p>
      </div>
    );

export default Loader;
