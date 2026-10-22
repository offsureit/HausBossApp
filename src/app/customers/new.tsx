import { Stack } from 'expo-router';
import { CustomerForm } from '~/components/customers/CustomerForm';

export default function NewCustomerScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'New customer' }} />
      <CustomerForm customer={null} />
    </>
  );
}
