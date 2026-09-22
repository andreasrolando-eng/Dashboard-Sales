import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "../db.js";
import { dateRange } from "../lib/dates.js";
import { optionalOutlet } from "../lib/validation.js";
import { toResult } from "../lib/output.js";
import { withToolErrorHandling } from "../lib/errors.js";

export function registerOpsTools(server: McpServer, db: Db) {
  server.registerTool(
    "ops_summary",
    {
      description:
        "Operational metrics for a date range: transaction totals/cancel-void counts/dwell time/discount sums, plus channel mix and payment method breakdown. Runs 3 queries via Promise.all (channel mix and payment method are separate source views from the totals) -- not one query.",
      inputSchema: dateRange.and(z.object({ outlet: optionalOutlet })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet }) => {
      const [[totals], byChannel, byPaymentMethod] = await Promise.all([
        db`
          select
            coalesce(sum(trans_count_all), 0) as trans_count_all,
            coalesce(sum(trans_count_finished), 0) as trans_count_finished,
            coalesce(sum(cancelled_count), 0) as cancelled_count,
            coalesce(sum(void_count), 0) as void_count,
            coalesce(sum(new_count), 0) as new_count,
            coalesce(sum(dwell_seconds_sum), 0) as dwell_seconds_sum,
            coalesce(sum(dwell_sample_count), 0) as dwell_sample_count,
            coalesce(sum(pax_total_sum), 0) as pax_total_sum,
            coalesce(sum(menu_discount_sum), 0) as menu_discount_sum,
            coalesce(sum(promotion_discount_sum), 0) as promotion_discount_sum,
            coalesce(sum(voucher_discount_sum), 0) as voucher_discount_sum
          from v_sales_ops_daily
          where sales_date between ${dateStart} and ${dateEnd}
            and (${outlet ?? null}::text is null or branch_code = ${outlet ?? null})
        `,
        db`
          select coalesce(channel, 'Tidak Diketahui') as channel,
            coalesce(sum(revenue), 0) as revenue,
            coalesce(sum(trans_count), 0) as trans_count
          from v_sales_channel_daily
          where sales_date between ${dateStart} and ${dateEnd}
            and (${outlet ?? null}::text is null or branch_code = ${outlet ?? null})
          group by channel
          order by revenue desc
        `,
        db`
          select coalesce(payment_method_type_name, 'Tidak Diketahui') as payment_method_type_name,
            coalesce(sum(payment_amount), 0) as payment_amount,
            coalesce(sum(payment_count), 0) as payment_count
          from v_sales_payment_method_daily
          where sales_date between ${dateStart} and ${dateEnd}
            and (${outlet ?? null}::text is null or branch_code = ${outlet ?? null})
          group by payment_method_type_name
          order by payment_amount desc
        `,
      ]);

      return toResult(`Ops summary for ${dateStart} to ${dateEnd}${outlet ? ` (outlet ${outlet})` : ""}.`, {
        totals,
        byChannel,
        byPaymentMethod,
      });
    })
  );
}
