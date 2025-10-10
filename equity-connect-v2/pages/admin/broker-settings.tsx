import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Broker {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  daily_lead_capacity: number;
  status: string;
  performance_score: number;
  current_balance: number;
}

interface BrokerStats {
  broker_id: string;
  company_name: string;
  daily_lead_capacity: number;
  leads_pulled_today: number;
  daily_target: number;
  progress_percent: number;
  pulls_remaining: number;
  current_zip: string;
  zips_processed: number;
  total_zips: number;
  total_cost_today: number;
  api_calls_today: number;
  status: string;
  last_pull_at: string;
}

export default function BrokerSettings() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [stats, setStats] = useState<BrokerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  // Fetch brokers and stats
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchStats, 30000); // Refresh stats every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchBrokers(), fetchStats()]);
    setLoading(false);
  };

  const fetchBrokers = async () => {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .eq('status', 'active')
      .order('company_name');
    
    if (!error && data) setBrokers(data);
  };

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('broker_pull_dashboard')
      .select('*')
      .order('company_name');
    
    if (!error && data) setStats(data);
  };

  const handleEditClick = (broker: Broker) => {
    setEditingId(broker.id);
    setEditValue(broker.daily_lead_capacity);
  };

  const handleSave = async (brokerId: string) => {
    const { error } = await supabase
      .from('brokers')
      .update({ 
        daily_lead_capacity: editValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', brokerId);

    if (!error) {
      setEditingId(null);
      fetchBrokers();
      fetchStats();
    } else {
      alert('Error updating capacity: ' + error.message);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading broker settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Broker Settings & Daily Pull Dashboard
        </h1>

        {/* Broker Settings Table */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Broker Configuration</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Lead Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {brokers.map(broker => (
                  <tr key={broker.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {broker.company_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{broker.contact_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{broker.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === broker.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(parseInt(e.target.value))}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            max="1000"
                          />
                          <button
                            onClick={() => handleSave(broker.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900">
                          {broker.daily_lead_capacity} leads/day
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        broker.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {broker.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId !== broker.id && (
                        <button
                          onClick={() => handleEditClick(broker)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit Capacity
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Pull Stats Dashboard */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Today's Pull Progress</h2>
            <p className="text-sm text-gray-500 mt-1">
              Real-time tracking of PropertyRadar lead pulls
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.map(stat => (
                <div key={stat.broker_id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {stat.company_name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      stat.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      stat.status === 'completed' ? 'bg-green-100 text-green-800' :
                      stat.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {stat.status?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Daily Progress</span>
                      <span className="font-medium text-gray-900">
                        {stat.leads_pulled_today || 0} / {stat.daily_target || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(stat.progress_percent || 0, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(stat.progress_percent || 0).toFixed(1)}% complete
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-gray-500 text-xs">Remaining</div>
                      <div className="font-semibold text-gray-900">
                        {stat.pulls_remaining || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Current ZIP</div>
                      <div className="font-semibold text-gray-900">
                        {stat.current_zip || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">ZIPs Processed</div>
                      <div className="font-semibold text-gray-900">
                        {stat.zips_processed || 0} / {stat.total_zips || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Cost Today</div>
                      <div className="font-semibold text-gray-900">
                        ${(stat.total_cost_today || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">API Calls</div>
                      <div className="font-semibold text-gray-900">
                        {stat.api_calls_today || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Last Pull</div>
                      <div className="font-semibold text-gray-900 text-xs">
                        {stat.last_pull_at 
                          ? new Date(stat.last_pull_at).toLocaleTimeString()
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {stats.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No pull activity today.</p>
                <p className="text-sm mt-2">
                  The workflow runs daily at 6am or can be triggered manually in n8n.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

