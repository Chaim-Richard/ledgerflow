import os

with open('src/components/platform/SystemCommandCenter.tsx', 'r') as f:
    code = f.read()

target = """  useEffect(() => {
    fetchTelemetry();
    fetchGlobalConfig();
    fetchUsersData();
    const interval = setInterval(() => {
    useEffect(() => {
    fetchTelemetry();
      fetchUsersData();
    }, 6000);
    return () => clearInterval(interval);
  }, []);"""

replacement = """  useEffect(() => {
    fetchTelemetry();
    fetchGlobalConfig();
    fetchUsersData();
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchUsersData();
    }, 6000);
    return () => clearInterval(interval);
  }, []);"""

code = code.replace(target, replacement)

with open('src/components/platform/SystemCommandCenter.tsx', 'w') as f:
    f.write(code)
