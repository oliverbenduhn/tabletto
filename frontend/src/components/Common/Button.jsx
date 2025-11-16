function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition disabled:cursor-not-allowed disabled:opacity-60';
  const variants = {
    primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
    ghost: 'bg-transparent text-gray-600 hover:text-gray-900 focus:ring-blue-500'
  };

  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default Button;
