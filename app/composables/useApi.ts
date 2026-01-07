
export const useApi = () => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.API_URL;
  const token = useCookie("kollel_sys_token");

  return async (url: string, options: any = {}) => {
    try {
      return await $fetch(url, {
        baseURL: baseUrl,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        },
        ...options,
      });
    } catch (error: any) {
      if (error.response?._data?.reLogin === true) {
        token.value = null; // Clear cookie correctly
        navigateTo('/login')
      }

      // ✅ Return the full error response if available
      if (error.response) {
        return error.response; // This allows you to see the actual response error
      }

      // ✅ Return a structured error object instead of throwing
      return {
        success: false,
        message: error?.data?.message || "An unexpected error occurred.",
        status: error?.status || 500,
      };
    }
  };
};



