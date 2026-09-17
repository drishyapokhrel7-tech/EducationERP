import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMarketingPartnerDto } from "./dto/create-marketing-partner.dto";
import { UpdateMarketingPartnerDto } from "./dto/update-marketing-partner.dto";
import { ListCommissionsQueryDto } from "./dto/list-commissions-query.dto";
import { MarkCommissionPaidDto } from "./dto/mark-commission-paid.dto";

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

// Platform-level, like PlatformOrganizationsService — MarketingPartner/
// MarketingCommission carry no organizationId of their own (a partner
// can refer many orgs), so every query here is a plain
// this.prisma.marketingPartner/marketingCommission call, never
// withTenant.
@Injectable()
export class PlatformMarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async listPartners() {
    const partners = await this.prisma.marketingPartner.findMany({ orderBy: { createdAt: "desc" } });
    return partners.map((p) => ({ ...p, commissionRatePercent: toNumber(p.commissionRatePercent) }));
  }

  async createPartner(dto: CreateMarketingPartnerDto) {
    const existing = await this.prisma.marketingPartner.findFirst({
      where: { referralCode: { equals: dto.referralCode, mode: "insensitive" } },
    });
    if (existing) throw new ConflictException("Referral code already in use");
    const partner = await this.prisma.marketingPartner.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        referralCode: dto.referralCode,
        payoutAccount: dto.payoutAccount,
        commissionRatePercent: dto.commissionRatePercent,
      },
    });
    return { ...partner, commissionRatePercent: toNumber(partner.commissionRatePercent) };
  }

  async updatePartner(id: string, dto: UpdateMarketingPartnerDto) {
    const partner = await this.prisma.marketingPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException("Marketing partner not found");
    const updated = await this.prisma.marketingPartner.update({ where: { id }, data: dto });
    return { ...updated, commissionRatePercent: toNumber(updated.commissionRatePercent) };
  }

  async listCommissions(query: ListCommissionsQueryDto) {
    const commissions = await this.prisma.marketingCommission.findMany({
      where: { status: query.status, marketingPartnerId: query.partnerId },
      include: { marketingPartner: { select: { name: true } }, organization: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    return commissions.map(({ marketingPartner, organization, ...c }) => ({
      ...c,
      depositedAmount: toNumber(c.depositedAmount),
      commissionRatePercent: toNumber(c.commissionRatePercent),
      commissionAmount: toNumber(c.commissionAmount),
      partnerName: marketingPartner.name,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    }));
  }

  async markCommissionPaid(id: string, platformAdminId: string, dto: MarkCommissionPaidDto) {
    const commission = await this.prisma.marketingCommission.findUnique({ where: { id } });
    if (!commission) throw new NotFoundException("Commission not found");
    if (commission.status === "PAID") throw new ConflictException("Commission already marked paid");
    const updated = await this.prisma.marketingCommission.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidByPlatformAdminId: platformAdminId,
        note: dto.note ?? commission.note,
      },
    });
    return {
      ...updated,
      depositedAmount: toNumber(updated.depositedAmount),
      commissionRatePercent: toNumber(updated.commissionRatePercent),
      commissionAmount: toNumber(updated.commissionAmount),
    };
  }
}
