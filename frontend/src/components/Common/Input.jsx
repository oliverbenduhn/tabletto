function Input({ label, error, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      {label && <span>{label}</span>}
      <input
        className={`rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

export default Input;
