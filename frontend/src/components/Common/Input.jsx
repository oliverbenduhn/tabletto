function Input({ label, error, helper, className = '', containerClassName = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-gray-700 ${containerClassName}`}>
      {label && <span className="font-medium text-gray-800">{label}</span>}
      <input
        className={`rounded-lg border px-3 py-2 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500'
        } ${className}`}
        {...props}
      />
      {helper && !error && <span className="text-xs text-gray-500">{helper}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

export default Input;
