// Temporary mock to fix missing file error
export function useClaimStream() {
  return {
    claim: async () => console.log("Claiming..."),
    loading: false,
    error: null
  };
}